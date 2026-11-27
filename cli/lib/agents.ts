import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { browsersPath } from "./browsers.ts"
import { runDriver } from "./drivers.ts"
import { defaultHarness, type Harness, harnesses, harnessHome, harnessIds, isHarness, isSpawnHarness, type SpawnHarnessId, toHarness } from "./harnesses.ts"
import { cliRoot } from "./paths.ts"
import { claudeCodeEnv, codexProvider } from "./providers.ts"
import type { McpServer } from "./setups.ts"
import { findSessionFiles } from "./workspace.ts"

export interface AgentSettings {
  harness: Harness
  model: string
  /** Codex: `model_reasoning_effort`. Claude Code: `--effort`. A driver harness: `default`, the effort its model id names. */
  reasoning: string
}

/**
 * The agents this eval compares, at the effort their vendor (or common use) recommends for a long unattended coding run.
 * `--agent <name>` picks one; `--model` alone takes that model's effort from here.
 * - Opus 5.5: medium, Claude Code's default for it.
 * - Fable 5.2: high. Anthropic's Fable 5.2 prompting guide: "Start at `high`, the default on the Claude API", and high
 *   "suits hard coding, research, agentic work, and long unattended runs".
 * - Sol 6.1: xhigh, the level Codex users run long coding tasks at.
 */
export const modelSet = {
  opus: { harness: "claude-code", model: "claude-opus-5-5", reasoning: "medium" },
  fable: { harness: "claude-code", model: "claude-fable-5-2", reasoning: "high" },
  sol: { harness: "codex", model: "gpt-6.1-sol", reasoning: "xhigh" },
} as const satisfies Record<string, AgentSettings>

export type AgentName = keyof typeof modelSet

/** `opus` for a model of the model set, else the model id. Run ids carry it. */
export function agentName(settings: AgentSettings): string {
  return Object.entries(modelSet).find(([, agent]) => agent.model === settings.model)?.[0] ?? settings.model
}

/**
 * The settings of a run: a named agent, or a harness (`--agent gemini` or `--harness gemini`) with its default model
 * and `model` and `reasoning` overrides.
 */
export function resolveSettings(options: { agent?: string, harness?: string, model?: string, reasoning?: string }): AgentSettings {
  if (options.agent && !isHarness(options.agent)) {
    const agent = modelSet[options.agent as AgentName]
    if (!agent) throw new Error(`Unknown agent ${options.agent}. Use ${Object.keys(modelSet).join(", ")}, or a harness: ${harnessIds.join(", ")}.`)
    return { ...agent, ...(options.reasoning ? { reasoning: options.reasoning } : {}) }
  }
  const harness = toHarness(options.agent ?? options.harness ?? defaultHarness)
  const entry = harnesses[harness]
  if (entry.launch === "driver") {
    const model = options.model ?? ("model" in entry ? entry.model : undefined)
    if (!model) throw new Error(`${entry.label} has no default model here. Pass --model.`)
    if (options.reasoning) throw new Error(`--reasoning is for Codex and Claude Code. ${entry.label} takes the effort its model id names, such as CLIProxy's gemini-3.8-flash-high.`)
    return { harness, model, reasoning: "default" }
  }
  const base = modelSet[entry.defaultAgent]
  const known = Object.values(modelSet).find(agent => agent.model === options.model && agent.harness === harness)
  return { ...base, ...known, ...(options.model ? { model: options.model } : {}), ...(options.reasoning ? { reasoning: options.reasoning } : {}) }
}

export interface AgentLaunch {
  prompt: string
  work: string
  home: string
  settings: AgentSettings
  /** Where the CLI's stdout goes (`--json` / `stream-json` events). */
  streamFile: string
  /** A driver harness: where its event log goes. Without it, `session.jsonl` next to `streamFile`. */
  sessionLog?: string
  /** The `acp` harness: the ACP registry agent it runs. */
  acpAgent?: string
  /** The port the agent's dev server should use. Parallel runs get different ones. */
  port?: number
  /** MCP servers of the setup. Setup A has none. */
  mcpServers?: McpServer[]
  /** Skills the setup installs. Setup A has none, and then the agent gets no skills at all. */
  skills?: string[]
  timeoutMs?: number
  /** Operate tasks: what the agent may use instead of the coding tools, and the browser or bridge it drives. */
  driver?: AgentDriver
}

/** A stdio MCP server, started by the agent CLI. */
export interface StdioMcpServer {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
}

/**
 * How an operate task's agent reaches the running app. `tools` are Claude Code's built-in tools (`[]` for none);
 * `shell: false` turns off Codex's shell. `env` and `path` add to the agent's environment, such as the
 * `agent-browser` CLI and its session.
 */
export interface AgentDriver {
  tools: string[]
  shell: boolean
  stdioMcpServers: StdioMcpServer[]
  env: Record<string, string>
  path: string[]
}

export interface AgentExit {
  code: number | null
  error?: string
  /** The session file the agent CLI wrote. */
  sessionFile?: string
}

/**
 * With setup skills, Claude Code would also offer its own: the bundled ones (code-review, simplify, dataviz...), the
 * builtin plugin's plugin-authoring, and the prompt commands the model can call as skills (security-review, init...).
 * Opus told to "USE ALL THE SKILLS." ran them in the first VS batch (2026-11-21). These settings leave only the
 * setup's skills; the builtin plugins still load, so AGENTS.md handling stays as before. The audit flags any other.
 */
const claudeOnlySetupSkills = {
  disableBundledSkills: true,
  skillOverrides: Object.fromEntries(["doctor", "plugin-authoring", "security-review", "init", "insights", "team-onboarding"].map(name => [name, "off"])),
}

export interface AgentCommand {
  bin: string
  args: string[]
  env: Record<string, string>
}

/** What every harness's process gets, before its own variables. */
export function baseEnv(launch: AgentLaunch): Record<string, string> {
  // A minimal PATH: `pnpm evals` adds this repo's node_modules/.bin folders, which would show the agent the eval.
  const path = [...launch.driver?.path ?? [], dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"].join(":")
  // COREPACK_HOME: the empty HOME would make corepack download pnpm again on the agent's first call (about 80 s).
  // PORT: `nuxt dev` would otherwise take 3000, which other services on this machine use.
  // PLAYWRIGHT_BROWSERS_PATH: the same browsers for every run (browsers.ts), instead of whatever the host's disk holds.
  return { PATH: path, HOME: launch.home, LANG: "C.UTF-8", TERM: "dumb", COREPACK_HOME: join(homedir(), ".cache/node/corepack"), PLAYWRIGHT_BROWSERS_PATH: browsersPath, PORT: String(launch.port ?? 4900), ...launch.driver?.env }
}

const binPath = (harness: SpawnHarnessId) => join(cliRoot, "node_modules/.bin", harnesses[harness].bin)

async function codexCommand(launch: AgentLaunch): Promise<AgentCommand> {
  const { settings, driver } = launch
  const stdio = driver?.stdioMcpServers ?? []
  const mcp = launch.mcpServers ?? []
  const provider = await codexProvider()
  const config = harnessHome("codex", launch.home).config
  await mkdir(config, { recursive: true })
  return {
    bin: binPath("codex"),
    args: [
      // An operate run's browser starts Chrome and a daemon with sockets outside the working copy, which the
      // workspace sandbox blocks. Its working copy is an empty folder, and the audit flags commands that leave the driver.
      "exec", "--json", "--skip-git-repo-check", "--sandbox", driver ? "danger-full-access" : "workspace-write", "-C", launch.work,
      "-m", settings.model,
      "-c", `model_reasoning_effort=${JSON.stringify(settings.reasoning)}`,
      "-c", `model_reasoning_summary="detailed"`,
      ...provider.config.flatMap(line => ["-c", line]),
      // The sandbox only writes the working copy by default, so pnpm can't create its cache in HOME and `pnpm build`
      // fails. It also blocks the network, which stops web search, installs and a local server. The web is open in
      // every setup (plan-v2), so the sandbox allows both; the HOME is the run's own empty folder. The browsers folder
      // is writable too, so an agent on another Playwright version can install its Chromium, as Claude Code can.
      "-c", `sandbox_workspace_write.writable_roots=[${JSON.stringify(launch.home)},${JSON.stringify(browsersPath)}]`,
      "-c", "sandbox_workspace_write.network_access=true",
      // Setup A is bare Codex: no curated plugins (their skills leaked in v0), no apps, no browser or computer use.
      ...["plugins", "remote_plugin", "apps", "browser_use", "computer_use", "image_generation"].flatMap(feature => ["--disable", feature]),
      // No bundled system skills (imagegen, openai-docs, skill-installer...) in any setup: the only skills an agent
      // gets are the setup's own, which Codex still loads from $CODEX_HOME/skills.
      "-c", "skills.bundled.enabled=false",
      ...mcp.flatMap(server => ["-c", `mcp_servers.${server.name}.url=${JSON.stringify(server.url)}`]),
      ...stdio.flatMap(server => [
        "-c", `mcp_servers.${server.name}.command=${JSON.stringify(server.command)}`,
        "-c", `mcp_servers.${server.name}.args=${JSON.stringify(server.args)}`,
        "-c", `mcp_servers.${server.name}.env={${Object.entries(server.env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(",")}}`,
        "-c", `mcp_servers.${server.name}.startup_timeout_sec=60`,
        "-c", `mcp_servers.${server.name}.default_tools_approval_mode="approve"`,
      ]),
      // An operate task works a running app, not code: no web search, and a bridge driver gets no shell at all.
      ...(driver ? ["-c", `web_search="disabled"`, "-c", `approval_policy="never"`, ...(driver.shell ? [] : ["--disable", "shell_tool", "--disable", "unified_exec"])] : []),
      // The prompt comes on stdin (see runAgentCli).
      "-",
    ],
    env: { ...baseEnv(launch), [harnesses.codex.configEnv]: config, ...provider.env },
  }
}

async function claudeCodeCommand(launch: AgentLaunch): Promise<AgentCommand> {
  const { settings, driver } = launch
  const stdio = driver?.stdioMcpServers ?? []
  const mcp = launch.mcpServers ?? []
  const skills = launch.skills ?? []
  return {
    bin: binPath("claude-code"),
    args: [
      // The prompt comes on stdin (see runAgentCli).
      "-p",
      "--output-format", "stream-json", "--verbose",
      "--model", settings.model,
      "--effort", settings.reasoning,
      // showThinkingSummaries: without it the transcript keeps only signed, empty thinking blocks.
      "--settings", JSON.stringify({ showThinkingSummaries: true, ...skills.length ? claudeOnlySetupSkills : {} }),
      "--permission-mode", "acceptEdits",
      ...(driver ? ["--tools", driver.tools.join(",")] : []),
      "--allowedTools", [...driver?.tools ?? ["Bash", "Read", "Edit", "MultiEdit", "Write", "Glob", "Grep", "WebSearch", "WebFetch", "TodoWrite", ...(skills.length ? ["Skill"] : [])], ...[...mcp, ...stdio].map(server => `mcp__${server.name}`)].join(","),
      // Without setup skills (A), no skills or commands at all.
      ...(skills.length ? [] : ["--disable-slash-commands"]),
      // Only the setup's MCP servers, never ones from a config file.
      "--strict-mcp-config",
      ...(mcp.length || stdio.length
        ? ["--mcp-config", JSON.stringify({ mcpServers: Object.fromEntries([
            ...mcp.map(server => [server.name, { type: "http", url: server.url }]),
            ...stdio.map(server => [server.name, { type: "stdio", command: server.command, args: server.args, env: server.env }]),
          ]) })]
        : []),
    ],
    env: {
      ...baseEnv(launch),
      [harnesses["claude-code"].configEnv]: harnessHome("claude-code", launch.home).config,
      ...await claudeCodeEnv(),
      DISABLE_AUTOUPDATER: "1",
      DISABLE_TELEMETRY: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      // MCP tools load up front, as tools a model API gets, instead of behind a tool search call.
      ...(driver ? { ENABLE_TOOL_SEARCH: "false" } : {}),
    },
  }
}

/** How each spawned harness's CLI is started. A spawn harness in harnesses.ts needs one here. */
const launchers: Record<SpawnHarnessId, (launch: AgentLaunch) => Promise<AgentCommand>> = {
  "codex": codexCommand,
  "claude-code": claudeCodeCommand,
}

/** The command line of a spawned harness, for tests: the binary, its arguments, and its variables. */
export async function spawnCommand(launch: AgentLaunch & { settings: { harness: SpawnHarnessId } }): Promise<AgentCommand> {
  return await launchers[launch.settings.harness](launch)
}

/**
 * Run the agent once in the sandbox. Codex and Claude Code start as a process with their flags; every other harness
 * through its driver (drivers.ts). Resolves when it exits; never throws for a failed run.
 */
export async function runAgentCli(launch: AgentLaunch): Promise<AgentExit> {
  const harness = launch.settings.harness
  if (!isSpawnHarness(harness)) {
    const { label } = harnesses[harness]
    // The MCP servers and operate drivers go in through Codex's and Claude Code's own flags.
    if (launch.mcpServers?.length) throw new Error(`MCP setups (B, C, CS) run on Codex and Claude Code only, not ${label}. Use setup A, V or VS.`)
    if (launch.driver) throw new Error(`Operate tasks run on Codex and Claude Code only, not ${label}.`)
    return await runDriver(launch, { env: baseEnv(launch), sessionLog: launch.sessionLog ?? join(dirname(launch.streamFile), "session.jsonl"), ...launch.acpAgent ? { acpAgent: launch.acpAgent } : {} })
  }
  const { bin, args, env } = await launchers[harness](launch)
  const out = createWriteStream(launch.streamFile)
  // The prompt goes in on stdin, never in argv: an agent that runs `pkill -f "node.*nuxt.*dev"` matches every process
  // whose command line holds the prompt ("nuxt ... vitehub.dev"), which once killed three parallel runs at once.
  const child = spawn(bin, args, { cwd: launch.work, env, stdio: ["pipe", "pipe", "pipe"] })
  child.stdin.end(launch.prompt)
  child.stdout.pipe(out)
  let stderr = ""
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-8000)
  })
  const limitMs = launch.timeoutMs ?? 60 * 60_000
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    child.kill("SIGTERM")
  }, limitMs)
  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve)
    child.on("error", (error) => {
      stderr += `\n${error.message}`
      resolve(null)
    })
  })
  clearTimeout(timeout)
  await new Promise(resolve => out.end(resolve))
  const sessionFile = (await mainSessionFiles(await findSessionFiles(harnessHome(harness, launch.home).sessions))).at(-1)
  // Codex exits with 0 on SIGTERM, so a run stopped at the limit would otherwise look finished.
  if (timedOut) return { code, sessionFile, error: `Stopped at the ${Math.round(limitMs / 60_000)}-minute limit before the agent finished.` }
  return { code, sessionFile, ...(code === 0 ? {} : { error: stderr.trim().split("\n").slice(-5).join("\n") || `Exited with code ${code}.` }) }
}

/**
 * Drops the logs of subagents the agent started. Codex writes each one as its own rollout file whose first line names a
 * parent thread, and it sorts after the main one. Claude Code keeps them under `subagents/`.
 */
async function mainSessionFiles(files: string[]): Promise<string[]> {
  const main: string[] = []
  for (const file of files) {
    if (file.includes("/subagents/")) continue
    const first = (await readFile(file, "utf8").catch(() => "")).split("\n", 1)[0] ?? ""
    try {
      const meta = JSON.parse(first) as { type?: string, payload?: { source?: { subagent?: unknown }, parent_thread_id?: string } }
      if (meta.type === "session_meta" && (meta.payload?.source?.subagent || meta.payload?.parent_thread_id)) continue
    }
    catch {}
    main.push(file)
  }
  return main
}
