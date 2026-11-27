// Every harness except Codex and Claude Code starts through its `@vite-hub/agent` driver. The run gets the same
// sandbox as a spawned one: its own HOME (and XDG folders inside it), the minimal PATH, and the working copy as cwd.
// The driver writes the provider runtime's event log to the run folder, which sessions.ts reads.
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { acpDriver, agentWithSkills, antigravityDriver, cursorDriver, defineAgent, fxDriver, geminiDriver, grokDriver, kimiDriver, kiroDriver, museDriver, opencodeDriver, piDriver } from "@vite-hub/agent"
import { runAgentForTest } from "@vite-hub/agent/test"
import type { AgentExit, AgentLaunch } from "./agents.ts"
import { type DriverHarness, type Harness, harnesses, harnessSkillsDir, isSpawnHarness, type SpawnHarnessId } from "./harnesses.ts"
import { cliRoot } from "./paths.ts"
import { driverGateway } from "./providers.ts"

export type DriverHarnessId = Exclude<Harness, SpawnHarnessId>

const factories = {
  gemini: geminiDriver,
  antigravity: antigravityDriver,
  opencode: opencodeDriver,
  cursor: cursorDriver,
  grok: grokDriver,
  pi: piDriver,
  kimi: kimiDriver,
  kiro: kiroDriver,
  fx: fxDriver,
  muse: museDriver,
  acp: acpDriver,
} satisfies Record<DriverHarnessId, unknown>

/** The project-local prefix harness CLIs install into: `npm install -g --prefix cli/.data/tools <package>`. */
export const toolsRoot = join(cliRoot, ".data/tools")

function driverSpec(harness: Harness): DriverHarness {
  if (isSpawnHarness(harness)) throw new Error(`${harnesses[harness].label} starts with its own flags, not a driver.`)
  return harnesses[harness]
}

/** The harness's CLI: the one in `cli/.data/tools/bin`, else the one on PATH. The generic ACP harness has none. */
export function harnessBinary(harness: Harness, path = process.env.PATH ?? ""): string | undefined {
  const { command, install, label } = driverSpec(harness)
  if (!command) return undefined
  const local = join(toolsRoot, "bin", command)
  if (existsSync(local)) return local
  try {
    return execFileSync("which", [command], { encoding: "utf8", env: { PATH: path } }).trim()
  }
  catch {
    throw new Error(`${label} isn't installed. ${install}.`)
  }
}

export interface DriverRun {
  /** The run's base environment (agents.ts `baseEnv`): PATH, HOME, locale, PORT, browsers. */
  env: Record<string, string>
  binaryPath?: string
  /** The ACP registry agent of the `acp` harness. */
  acpAgent?: string
  /** Where the driver writes the provider runtime's event log. */
  sessionLog: string
}

/** What the harness's driver gets. Pure, so each harness's options are tested without starting it. */
export function driverOptions(launch: AgentLaunch, run: DriverRun) {
  const harness = launch.settings.harness
  const spec = driverSpec(harness)
  const gateway = driverGateway(harness)
  if (harness === "acp" && !run.acpAgent) throw new Error("The acp harness runs an agent of the ACP registry. Name it with --acp-agent, such as --acp-agent cline.")
  const { home } = launch
  const env: Record<string, string> = {
    ...run.env,
    // A CLI that follows XDG keeps its config, data and cache in the run's HOME too.
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local/share"),
    XDG_CACHE_HOME: join(home, ".cache"),
    XDG_STATE_HOME: join(home, ".local/state"),
    // The host's value of this variable would otherwise reach the CLI (ViteHub passes it on), with the host's logins.
    ...spec.home && !(gateway && spec.home.gatewayOwned) ? { [spec.home.env]: join(home, spec.home.path) } : {},
    // Without a gateway the CLI signs in with its own key from cli/.env.
    ...gateway ? {} : Object.fromEntries(spec.authEnv.flatMap(name => process.env[name] ? [[name, process.env[name]!]] : [])),
  }
  return {
    cwd: launch.work,
    sessionLog: run.sessionLog,
    model: launch.settings.model,
    // The run is unattended and the sandbox is the run's own folders, as for Codex and Claude Code.
    permissions: "allow-all" as const,
    env,
    ...gateway ? { gateway: gateway.value } : {},
    ...run.binaryPath ? { providerSettings: { binaryPath: run.binaryPath } } : {},
    ...harness === "acp" ? { agentId: run.acpAgent! } : {},
  }
}

/** Each skill folder in `folder` as its files by relative path, the shape `agentWithSkills` takes. */
export async function skillFolders(folder: string): Promise<Record<string, Record<string, Uint8Array>>> {
  const skills: Record<string, Record<string, Uint8Array>> = {}
  for (const skill of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
    if (!skill.isDirectory()) continue
    const root = join(folder, skill.name)
    const files: Record<string, Uint8Array> = {}
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) files[relative(root, join(entry.parentPath, entry.name))] = await readFile(join(entry.parentPath, entry.name))
    }
    skills[skill.name] = files
  }
  return skills
}

/** Runs the harness's driver once. Resolves when the turn ends; never throws for a failed run. */
export async function runDriver(launch: AgentLaunch, run: Omit<DriverRun, "binaryPath">): Promise<AgentExit> {
  const harness = launch.settings.harness as DriverHarnessId
  const controller = new AbortController()
  const limitMs = launch.timeoutMs ?? 60 * 60_000
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, limitMs)
  try {
    const options = driverOptions(launch, { ...run, binaryPath: harnessBinary(harness) })
    const driver = (factories[harness] as (options: unknown) => Parameters<typeof defineAgent>[0]["driver"])(options)
    // Gemini CLI and Kimi Code read skills in the private home the gateway gives them, where ViteHub copies them.
    const skills = driverSpec(harness).gatewaySkills ? await skillFolders(harnessSkillsDir(harness, launch.home)!) : {}
    const agent = Object.keys(skills).length ? agentWithSkills(defineAgent({ driver }), skills) : defineAgent({ driver })
    await runAgentForTest(agent, { runtimeConfig: {} }, { prompt: launch.prompt, abortSignal: controller.signal })
    return { code: 0, sessionFile: run.sessionLog }
  }
  catch (error) {
    if (timedOut) return { code: null, sessionFile: run.sessionLog, error: `Stopped at the ${Math.round(limitMs / 60_000)}-minute limit before the agent finished.` }
    return { code: 1, sessionFile: existsSync(run.sessionLog) ? run.sessionLog : undefined, error: error instanceof Error ? error.message : String(error) }
  }
  finally {
    clearTimeout(timeout)
  }
}
