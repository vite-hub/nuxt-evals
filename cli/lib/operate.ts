// Operate runs: one agent works the running ui-sdk app with one driver, browser tools (the `agent-browser` CLI, as
// ViteHub's browser() capability mounts it) or ui-sdk's agent bridge (a stdio MCP server, `bridge-mcp.ts`). Each run gets
// its own app server, HOME and empty working folder. Results go to `.data/operate/<id>/`.
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { type AgentSession, type AgentSessionTool, readAgentSession } from "@vite-hub/agent/sessions"
import type { Harness, RunUsage } from "../../site/shared/report.ts"
import { startOperateServer } from "../../tasks/vitehub-ui/operate/server.ts"
import { driverNote, type OperateDriver, type OperateTask } from "../../tasks/vitehub-ui/operate/tasks.ts"
import { type AgentDriver, type AgentSettings, agentName, runAgentCli } from "./agents.ts"
import { cliRoot, repoRoot } from "./paths.ts"
import { runHeavy } from "./prepare.ts"
import { priceUsage } from "./pricing.ts"
import { agentSkillsDir } from "./setups.ts"

const exec = promisify(execFile)

export const operateRoot = join(cliRoot, ".data/operate")
/** The agent-browser version ViteHub's managed browser() runtime pins (packages/agent/src/internal/browser-runtime.ts). */
const agentBrowserVersion = "0.35.2"
const agentBrowserRoot = join(homedir(), ".cache/nuxt-evals", `agent-browser-${agentBrowserVersion}`)
const bridgeServer = join(repoRoot, "tasks/vitehub-ui/operate/bridge-mcp.ts")

export interface OperateMetrics {
  /** Every tool call. */
  toolCalls: number
  /** Calls that read or changed the page. Loading a tool's instructions (`agent-browser skills get`, `--help`, the skill) is not one. */
  pageCalls: number
  /** Characters of every tool result the agent read. */
  chars: number
  /** Characters of page calls' results. */
  pageChars: number
  /** Shell commands that reached the app another way than the driver, such as curl or fetch() to its API. */
  bypasses: string[]
}

export interface OperateRecord {
  id: string
  task: string
  driver: OperateDriver
  harness: Harness
  model: string
  reasoning: string
  repeat: number
  startedAt: string
  /** The agent CLI's wall time. App start and grading are not in it. */
  durationMs: number
  passed: boolean
  /** The harness failed, not the agent. Such runs are left out of the report and run again. */
  harnessError?: string
  detail: string
  metrics: OperateMetrics
  usage: RunUsage
  error?: string
  finalText: string
}

/** Installs the agent-browser version ViteHub pins, once. */
async function agentBrowser(): Promise<{ bin: string, skill: string }> {
  const bin = join(agentBrowserRoot, "node_modules/.bin/agent-browser")
  const ready = await exec(bin, ["--version"]).then(result => result.stdout.trim() === `agent-browser ${agentBrowserVersion}`, () => false)
  if (!ready) {
    await mkdir(agentBrowserRoot, { recursive: true })
    await exec("npm", ["install", "--prefix", agentBrowserRoot, "--no-audit", "--no-fund", "--ignore-scripts", `agent-browser@${agentBrowserVersion}`])
  }
  const official = await readFile(join(agentBrowserRoot, "node_modules/agent-browser/skills/agent-browser/SKILL.md"), "utf8")
  // The skill as ViteHub's managed runtime writes it: the official discovery skill without `hidden` and its install
  // line, then ViteHub's screenshot and managed-runtime notes.
  const skill = `${official.replace(/^hidden:\s*true\s*$/m, "").replace(/^Install:.*$/m, "").trim()}\n\n## ViteHub screenshots\n\nSave screenshots under \`screenshots/\`. To attach one to the final reply, add \`![Description](screenshots/name.png)\` on its own line.\n\n## Managed runtime\n\nBefore following any browser instructions, check that \`AGENT_BROWSER_SESSION\` is set. If it is absent, the managed browser capability is inactive: do not run browser commands or installation steps from this Skill. Ask the caller to enable browser() for this Agent. If it is set, ViteHub has prepared the CLI and browser and assigned an isolated session for this invocation. Use \`agent-browser\` directly. Keep the configured \`AGENT_BROWSER_SESSION\`; skip installation and session setup examples in the CLI guide. Do not use \`npx\` or override \`--session\`. ViteHub closes the session when this invocation finishes.\n`
  return { bin, skill }
}

/** Installs and builds the operate app once. Every run serves the same build. */
export async function ensureOperateApp(): Promise<void> {
  const app = join(repoRoot, "tasks/vitehub-ui/operate/app")
  if (await readFile(join(app, "dist/index.html")).then(() => true, () => false)) return
  await runHeavy(["pnpm", "install", "--frozen-lockfile"], { cwd: app, timeoutMs: 600_000 })
  await runHeavy(["node_modules/.bin/vite", "build"], { cwd: app, timeoutMs: 600_000, remote: true })
}

/** The Chromium that playwright-core ships, for agent-browser. The bridge's server launches the same one. */
async function chromiumPath(): Promise<string> {
  const require = createRequire(join(cliRoot, "package.json"))
  const playwright = await import(pathToFileURL(join(dirname(require.resolve("playwright-core/package.json")), "index.mjs")).href) as typeof import("playwright-core")
  return playwright.chromium.executablePath()
}

function text(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(text).join("")
  if (value && typeof value === "object") {
    const record = value as { text?: unknown, output?: unknown, content?: unknown }
    if (typeof record.text === "string") return record.text
    if (record.output !== undefined) return text(record.output)
    if (record.content !== undefined) return text(record.content)
  }
  return value === undefined || value === null ? "" : JSON.stringify(value)
}

function commandOf(tool: AgentSessionTool): string {
  const input = tool.input as { command?: unknown, cmd?: unknown } | undefined
  const command = input?.command ?? input?.cmd
  return Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : ""
}

const instructionCommand = /agent-browser\s+(skills\b|--help|-h\b|help\b|--version)|SKILL\.md/
const bypassCommand = /\bcurl\b|\bwget\b|fetch\(|XMLHttpRequest|\/api\/(settings|invites)/

/**
 * Counts from the session. For the bridge, `bridgeCalls` (the MCP server's own log) gives the page calls and their exact
 * characters: the CLIs wrap MCP results in JSON of their own, which would count quotes and escapes too.
 */
export function operateMetrics(session: AgentSession, driver: OperateDriver, bridgeCalls: { chars: number }[] = []): OperateMetrics {
  const tools = session.steps.filter((step): step is AgentSessionTool => step.type === "tool")
  const metrics: OperateMetrics = { toolCalls: tools.length, pageCalls: 0, chars: 0, pageChars: 0, bypasses: [] }
  for (const tool of tools) {
    const chars = text(tool.output).length
    metrics.chars += chars
    const command = commandOf(tool)
    const page = driver === "bridge"
      ? /(^|__|\.)(snapshot|query|act)$/.test(tool.name)
      : command.includes("agent-browser") && !instructionCommand.test(command)
    if (page) {
      metrics.pageCalls++
      metrics.pageChars += chars
    }
    // agent-browser's `open` takes the page's URL, and its `eval` may read the page. A request to the API is a bypass.
    if (command && bypassCommand.test(command.replace(/agent-browser\s+open\s+\S+/g, ""))) metrics.bypasses.push(command.slice(0, 200))
  }
  if (driver === "bridge") {
    metrics.chars += bridgeCalls.reduce((sum, call) => sum + call.chars, 0) - metrics.pageChars
    metrics.pageCalls = bridgeCalls.length
    metrics.pageChars = bridgeCalls.reduce((sum, call) => sum + call.chars, 0)
  }
  return metrics
}

/** A free port in 4760-4799 for the app. */
async function freePort(): Promise<number> {
  const { createServer } = await import("node:net")
  for (let port = 4760; port <= 4799; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const server = createServer().once("error", () => resolve(false)).listen(port, "127.0.0.1", () => server.close(() => resolve(true)))
    })
    if (free) return port
  }
  throw new Error("No free port in 4760-4799.")
}

export async function runOperate(task: OperateTask, driver: OperateDriver, settings: AgentSettings, stamp: string, repeat: number): Promise<OperateRecord> {
  const id = `${stamp}-${task.id}-${driver}-${agentName(settings)}-${repeat}`
  const folder = join(operateRoot, id)
  await mkdir(folder, { recursive: true })
  const scratch = join(homedir(), ".cache/nuxt-evals")
  const home = await mkdtemp(join(scratch, "home-"))
  const work = await mkdtemp(join(scratch, "operate-"))
  // A short path: Unix socket paths are limited to about 100 bytes.
  const sockets = await mkdtemp("/tmp/n1ab-")
  const app = await startOperateServer(await freePort())
  const log = join(folder, "bridge.jsonl")
  try {
    let launchDriver: AgentDriver
    let skills: string[] = []
    let browserEnv: Record<string, string> = {}
    if (driver === "browser") {
      const { bin, skill } = await agentBrowser()
      const skillDir = join(agentSkillsDir(settings.harness, home), "agent-browser")
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, "SKILL.md"), skill)
      skills = ["agent-browser"]
      browserEnv = {
        AGENT_BROWSER_EXECUTABLE_PATH: await chromiumPath(),
        AGENT_BROWSER_SOCKET_DIR: sockets,
        AGENT_BROWSER_SESSION: `n1-${repeat}-${Date.now().toString(36)}`,
        // This machine's AppArmor blocks Chrome's user-namespace sandbox; ViteHub's runtime sets the same flag then.
        AGENT_BROWSER_ARGS: "--no-sandbox",
        VITEHUB_BROWSER_ACTIVE: "1",
      }
      launchDriver = { tools: ["Bash", "Read", "Skill"], shell: true, stdioMcpServers: [], env: browserEnv, path: [dirname(bin)] }
    }
    else {
      launchDriver = {
        tools: [],
        shell: false,
        // The agent CLI starts the server with only this env, so Playwright needs its browsers' folder: HOME is the run's own.
        stdioMcpServers: [{ name: "page", command: process.execPath, args: [bridgeServer], env: { OPERATE_URL: `${app.origin}${task.path}`, OPERATE_LOG: log, PLAYWRIGHT_BROWSERS_PATH: join(homedir(), ".cache/ms-playwright") } }],
        env: {},
        path: [],
      }
    }
    const prompt = `${task.prompt(app.origin)}\n\n${driverNote[driver]}\n`
    await writeFile(join(folder, "prompt.md"), prompt)
    console.log(`${id}: running ${settings.harness} ${settings.model} (${settings.reasoning}) on ${app.origin}`)
    const started = new Date()
    const exit = await runAgentCli({ prompt, work, home, settings, skills, driver: launchDriver, timeoutMs: 10 * 60_000, streamFile: join(folder, "stream.jsonl") })
    const durationMs = Date.now() - started.getTime()
    if (driver === "browser") {
      await exec(join(agentBrowserRoot, "node_modules/.bin/agent-browser"), ["close"], { env: { ...process.env, ...browserEnv }, timeout: 15_000 }).catch(() => {})
    }
    const sessionText = exit.sessionFile ? await readFile(exit.sessionFile, "utf8") : ""
    const session = readAgentSession(settings.harness, sessionText)
    const bridgeLog = (await readFile(log, "utf8").catch(() => "")).split("\n").filter(Boolean).map(line => JSON.parse(line) as { ready?: string[], chars?: number })
    const metrics = operateMetrics(session, driver, bridgeLog.filter(entry => entry.chars !== undefined).map(entry => ({ chars: entry.chars ?? 0 })))
    const graded = task.check(app.state)
    const passed = graded.passed && metrics.bypasses.length === 0
    // A bridge that never started says nothing about the bridge: such a run is run again.
    const bridgeStarted = driver === "browser" || bridgeLog.some(entry => entry.ready)
    const harnessError = !bridgeStarted ? "The bridge's MCP server did not start." : undefined
    const model = session.model ?? settings.model
    const error = harnessError ?? exit.error ?? (sessionText ? session.error : "The agent wrote no session file.")
    const record: OperateRecord = {
      id,
      task: task.id,
      driver,
      harness: settings.harness,
      model,
      reasoning: session.reasoningEffort ?? settings.reasoning,
      repeat,
      startedAt: started.toISOString(),
      durationMs,
      passed,
      ...(harnessError ? { harnessError } : {}),
      detail: metrics.bypasses.length ? `Reached the app around the driver: ${metrics.bypasses[0]}` : graded.detail,
      metrics,
      usage: await priceUsage(settings.harness, model, session.usage),
      ...(error ? { error } : {}),
      finalText: session.text ?? "",
    }
    await writeFile(join(folder, "session.jsonl"), sessionText)
    await writeFile(join(folder, "state.json"), JSON.stringify(app.state, null, 2))
    await writeFile(join(folder, "run.json"), JSON.stringify(record, null, 2))
    console.log(`${id}: ${passed ? "passed" : "FAILED"} (${record.detail}), ${metrics.pageCalls}/${metrics.toolCalls} page/all calls, ${metrics.pageChars}/${metrics.chars} chars, ${Math.round(durationMs / 1000)} s, $${record.usage.costUsd ?? "?"}`)
    return record
  }
  finally {
    await app.close()
    await rm(home, { recursive: true, force: true })
    await rm(work, { recursive: true, force: true })
    await rm(sockets, { recursive: true, force: true })
  }
}

function median(values: number[]): number {
  if (!values.length) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export interface OperateGroup {
  task: string
  driver: OperateDriver
  agent: string
  runs: number
  passed: number
  pageCalls: number
  toolCalls: number
  pageChars: number
  chars: number
  seconds: number
  tokens: number
  costUsd: number
}

/** Medians per task, driver and agent, from the run folders. `ids` picks runs; by default every run. */
export async function operateGroups(records: OperateRecord[]): Promise<OperateGroup[]> {
  const groups = new Map<string, OperateRecord[]>()
  for (const record of records) {
    const key = `${record.task}\0${record.driver}\0${record.model}`
    groups.set(key, [...groups.get(key) ?? [], record])
  }
  return [...groups.values()].map(runs => ({
    task: runs[0]!.task,
    driver: runs[0]!.driver,
    agent: runs[0]!.model,
    runs: runs.length,
    passed: runs.filter(run => run.passed).length,
    pageCalls: median(runs.map(run => run.metrics.pageCalls)),
    toolCalls: median(runs.map(run => run.metrics.toolCalls)),
    pageChars: median(runs.map(run => run.metrics.pageChars)),
    chars: median(runs.map(run => run.metrics.chars)),
    seconds: Math.round(median(runs.map(run => run.durationMs)) / 1000),
    tokens: median(runs.map(run => (run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0))),
    costUsd: runs.reduce((sum, run) => sum + Number(run.usage.costUsd ?? 0), 0),
  })).sort((a, b) => `${a.task}${a.agent}${a.driver}`.localeCompare(`${b.task}${b.agent}${b.driver}`))
}

export async function readOperateRuns(batch?: string): Promise<OperateRecord[]> {
  const { readdir } = await import("node:fs/promises")
  const ids = (await readdir(operateRoot).catch(() => [])).filter(id => !batch || id.startsWith(batch)).sort()
  const records: OperateRecord[] = []
  for (const id of ids) {
    const record = await readFile(join(operateRoot, id, "run.json"), "utf8").then(text => JSON.parse(text) as OperateRecord, () => undefined)
    if (record && !record.harnessError) records.push(record)
  }
  return records
}
