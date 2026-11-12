// The rubric judge: Claude Code with Opus 5.5 grades a finished app against RUBRIC.md. It runs through CLIProxy, so it
// uses Maxi's Claude subscription, with an empty Claude config (no CLAUDE.md, skills, plugins, hooks or MCP servers).
//
// 1. Setup: one judge session installs, builds and checks the app the way its README says (P1, P3), then reports the
//    command that starts the production server.
// 2. The CLI starts that server once, on a fresh port.
// 3. Vite Doctor reads the installed app (cli/lib/doctor.ts).
// 4. Judge sessions grade the other sections, three at a time, against the running server and the code. One more
//    session, the vibe pass (tasks/<project>/VIBE.md), judges the design and scores it apart from the headline.
//
// What differs per project (how to build and serve the app, which sections each session takes, stack rules) is the
// task's `judge` config in tasks/<project>/task.ts.
// 5. The CLI scores each section with the rubric's rules (site/shared/rubric.ts). The judge never picks a score.
//
// The judge is blind: it grades the reference app exactly like a run, from a folder with a neutral name, and never
// learns which app it has. The reference gets a session log that records no session, so its "log" checks come back n/a.
import { type ChildProcess, execFile, spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { promisify } from "node:util"
import type { AgentSession } from "@vite-hub/agent/sessions"
import type { RunFile } from "../../site/shared/report.ts"
import { type CheckResult, type DoctorGrade, type JudgeSession, type RubricCheck, type RubricGrade, scoreRubric, type VibeFinding, type VibeGrade } from "../../site/shared/rubric.ts"
import { tasks } from "../../tasks/index.ts"
import { readRubric } from "../../tasks/rubric.ts"
import type { JudgeConfig } from "../../tasks/types.ts"
import { runDoctor, scoreDoctor } from "./doctor.ts"
import { type RawSource, resolveSources } from "./sources.ts"
import { cliRoot, tasksRoot } from "./paths.ts"
import { fileBytes, stopProcessesIn } from "./workspace.ts"

export const judgeModel = "claude-opus-5-5"
export const judgeEffort = "high"
/** Grading sessions at once. Slimbook is shared: at most three agent sessions run at a time. */
export const judgeParallel = Number(process.env.JUDGE_PARALLEL ?? 3)
/** Exit code of `evals judge` and `evals explain` when the judge's API refused a session. Nothing was written; try later. */
export const judgeUnavailableExit = 75
/** The judge's API refused or dropped a session (a 429, an overloaded model). What came back is no grade. */
export class JudgeUnavailableError extends Error {}
const apiFailure = /API Error|rate_limit_error|overloaded_error|cooling down/i

/** Runs jobs on `judgeParallel` workers. After a job throws, no new job starts; the first error is thrown once the running ones end. */
export async function runJobs(jobs: (() => Promise<void>)[]): Promise<void> {
  let failure: unknown
  const worker = async () => {
    for (let job = jobs.shift(); job && failure === undefined; job = jobs.shift()) {
      try {
        await job()
      }
      catch (error) {
        failure ??= error
      }
    }
  }
  await Promise.all(Array.from({ length: judgeParallel }, () => worker()))
  if (failure !== undefined) throw failure
}

/** The session log of an app no agent session built. */
const noSession = "# Session log\n\nNo agent session was recorded for this app.\n"

/** The judge config of a rubric project. Runs of the old `meetups-v2` id are Meetups. */
export function judgeConfig(project: string): JudgeConfig {
  const config = tasks[project === "meetups-v2" ? "meetups" : project]?.judge
  if (!config) throw new Error(`Project ${project} has no judge config in its task.ts.`)
  return config
}

const sourceSchema = {
  type: "object",
  properties: {
    path: { type: "string", description: "From the app's root." },
    line: { type: "integer", minimum: 1 },
    endLine: { type: "integer", minimum: 1 },
    quote: { type: "string", description: "The exact text of the first cited line. The CLI moves the place to where the quote is." },
  },
  required: ["path", "line"],
} as const
const text = { type: "string", minLength: 1 } as const

const vibeSchema = (apis: string) => ({
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 10, description: "0 to 10, one decimal, against the anchors." },
    summary: { type: "string", description: "Two or three sentences: the design in short, and what a reviewer would ask for first." },
    findings: {
      type: "array",
      // An elegant finding says why it works; every other kind also says the better way.
      items: {
        anyOf: [
          {
            type: "object",
            properties: {
              kind: { const: "elegant" },
              why: { ...text, description: "What works and why, in one or two sentences." },
              sources: { type: "array", items: sourceSchema, minItems: 1 },
            },
            required: ["kind", "why", "sources"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["missing-abstraction", "superfluous-abstraction", "reinvented", "structure"] },
              why: { ...text, description: "What's wrong and its effect, in one sentence." },
              fix: { ...text, description: `The better way, naming the ${apis} API to use.` },
              sources: { type: "array", items: sourceSchema, minItems: 1 },
            },
            required: ["kind", "why", "fix", "sources"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["score", "summary", "findings"],
} as const)

/** One check's answer. A fail must say why and how to fix it, so a grader can't leave them out. */
const answerSchema = (apis: string) => ({
  anyOf: [
    {
      type: "object",
      properties: {
        outcome: { type: "string", enum: ["pass", "na", "unverified"] },
        evidence: text,
        sources: { type: "array", items: sourceSchema },
      },
      required: ["outcome", "evidence", "sources"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        outcome: { const: "fail" },
        evidence: text,
        sources: { type: "array", items: sourceSchema, description: "Where the problem is in the app's code. Empty only when it is in behavior alone, such as a page that doesn't render." },
        why: { ...text, description: "What's wrong and its effect, in one sentence." },
        fix: { ...text, description: `The concrete better way, naming the ${apis} API to use.` },
      },
      required: ["outcome", "evidence", "sources", "why", "fix"],
      additionalProperties: false,
    },
  ],
} as const)

/** `results` keyed by check id, every id required, so a grader can't skip a check. A list let the judge drop P28 twice. */
function resultsFor(ids: string[], apis: string) {
  return { type: "object", properties: Object.fromEntries(ids.map(id => [id, answerSchema(apis)])), required: ids, additionalProperties: false }
}

function resultSchema(ids: string[], apis: string) {
  return { type: "object", properties: { results: resultsFor(ids, apis) }, required: ["results"] }
}

function setupSchema(ids: string[], apis: string) {
  return {
    type: "object",
    properties: {
      built: { type: "boolean", description: "The production build finished." },
      startCommand: { type: "string", description: "Shell command, run from the app folder, that starts the production server. Empty when it can't start." },
      env: { type: "object", additionalProperties: { type: "string" }, description: "Literal values of environment variables the start command doesn't load by itself, beyond PORT, HOST and NITRO_PORT/NITRO_HOST. Empty when the command reads them from .env." },
      notes: { type: "string", description: "What the graders should know: env you set, demo accounts, seed data, the mail outbox, problems." },
      results: resultsFor(ids, apis),
    },
    required: ["built", "startCommand", "env", "notes", "results"],
  }
}

function playwrightEntry(): string {
  const manifest = createRequire(join(cliRoot, "package.json")).resolve("playwright-core/package.json")
  return join(dirname(manifest), "index.mjs")
}

/**
 * Graders drive Chromium through this playwright-core. Its browser build comes with each playwright-core version and
 * may be missing from ~/.cache/ms-playwright; without it every browser check comes back unverified.
 */
async function ensureBrowser(log: (line: string) => void) {
  const cli = join(dirname(playwrightEntry()), "cli.js")
  await promisify(execFile)(process.execPath, [cli, "install", "chromium-headless-shell"], { timeout: 10 * 60_000 })
    .catch((error: Error) => log(`judge: could not install Playwright's Chromium: ${error.message.slice(0, 200)}`))
}

async function freePort(from: number, to: number): Promise<number> {
  for (let port = from; port <= to; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const server = createServer().once("error", () => resolve(false)).listen(port, "127.0.0.1", () => server.close(() => resolve(true)))
    })
    if (free) return port
  }
  throw new Error(`No free port in ${from}-${to}.`)
}

/** The agent's steps as plain text, for the "log" checks of section Z. */
export function sessionLog(session: AgentSession, finalText: string): string {
  const lines = session.steps.map((step, index) => {
    if (step.type === "message") return `#${index} ${step.phase === "reasoning" ? "thinking" : "note"}: ${step.text.slice(0, 800)}`
    const input = step.input as { command?: unknown } | undefined
    const command = typeof input?.command === "string" ? input.command : JSON.stringify(step.input ?? "")
    const output = typeof (step as { output?: unknown }).output === "string" ? (step as { output: string }).output : ""
    return `#${index} ${step.name}: ${command.slice(0, 1200)}${step.error ? `\n  error: ${step.error.slice(0, 400)}` : ""}${output ? `\n  output: ${output.slice(0, 600)}` : ""}`
  })
  return `${lines.join("\n\n")}\n\n## Final message\n\n${finalText}`
}

export interface JudgeOptions {
  /** Shown in our logs only. The judge never sees it. */
  label: string
  /** The project, such as `meetups`: its RUBRIC.md grades the app. */
  project: string
  files: RunFile[]
  prompt: string
  /** The agent's steps as text, or undefined for an app with no recorded session (the reference): its log checks are n/a. */
  sessionText?: string
  /** Where the judge transcripts go. */
  outDir: string
  /** The reference app, which the vibe pass compares with. Undefined when grading the reference itself. */
  reference?: RunFile[]
  /** The Doctor rules the reference app fires; they don't count against the app. Empty when grading the reference. */
  doctorBaseline?: string[]
  log: (line: string) => void
}

interface ClaudeResult {
  output?: unknown
  session: JudgeSession
}

function judgeEnv(home: string): Record<string, string> {
  const url = process.env.CLIPROXY_URL?.replace(/\/+$/, "").replace(/\/v1$/, "")
  const key = process.env.CLIPROXY_API_KEY
  if (!url || !key) throw new Error("Set CLIPROXY_URL and CLIPROXY_API_KEY in cli/.env.")
  // `pnpm evals` puts this repo's node_modules/.bin first. The judge doesn't need them.
  const path = (process.env.PATH ?? "").split(":").filter(entry => !entry.includes("nuxt-evals")).join(":")
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(ANTHROPIC_|CLAUDE|CLIPROXY|INGEST|SITE_URL|npm_|PNPM_)/.test(name))) as Record<string, string>,
    PATH: path,
    CLAUDE_CONFIG_DIR: join(home, ".claude"),
    ANTHROPIC_BASE_URL: url,
    ANTHROPIC_AUTH_TOKEN: key,
    ANTHROPIC_API_KEY: "",
    DISABLE_AUTOUPDATER: "1",
    DISABLE_TELEMETRY: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    NUXT_TELEMETRY_DISABLED: "1",
  }
}

/** One headless Claude Code session. `tools` limits it to those tools; without it, it gets the graders' tools. */
export async function askClaude(name: string, prompt: string, schema: object, cwd: string, home: string, outDir: string, timeoutMs: number, tools?: string): Promise<ClaudeResult> {
  const started = Date.now()
  // The prompt goes in on stdin. In argv it would sit in this process's command line, where a grader's
  // `pkill -f <app path>` matches it and kills the grader itself.
  const args = [
    "-p",
    "--model", judgeModel,
    "--effort", judgeEffort,
    "--output-format", "stream-json", "--verbose",
    "--json-schema", JSON.stringify(schema),
    "--permission-mode", "acceptEdits",
    ...(tools ? ["--tools", tools, "--allowedTools", tools] : ["--allowedTools", "Bash,Read,Glob,Grep,Write,TodoWrite"]),
    "--strict-mcp-config",
    "--setting-sources", "",
    "--disable-slash-commands",
  ]
  const transcript = join(outDir, `${name}.jsonl`)
  const out = createWriteStream(transcript)
  const child = spawn(join(cliRoot, "node_modules/.bin/claude"), args, { cwd, env: judgeEnv(home), stdio: ["pipe", "pipe", "pipe"] })
  child.stdin.end(prompt)
  let tail = ""
  let stderr = ""
  child.stdout.on("data", (chunk: Buffer) => {
    out.write(chunk)
    tail = (tail + chunk.toString()).slice(-400_000)
  })
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4000)
  })
  const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs)
  const code = await new Promise<number | null>((resolve, reject) => child.once("error", reject).on("close", resolve))
  clearTimeout(timer)
  await new Promise(resolve => out.end(resolve))
  type ResultEvent = { type?: string, structured_output?: unknown, total_cost_usd?: number, num_turns?: number, is_error?: boolean, result?: string }
  const result = tail.split("\n").filter(line => line.includes("\"type\":\"result\""))
    .map((line): ResultEvent | undefined => {
      try {
        return JSON.parse(line) as ResultEvent
      }
      catch {
        return undefined
      }
    })
    .filter(event => event?.type === "result").at(-1)
  if (result?.structured_output) await writeFile(join(outDir, `${name}.json`), JSON.stringify(result.structured_output, null, 2))
  const session: JudgeSession = {
    name,
    durationMs: Date.now() - started,
    ...(result?.total_cost_usd ? { costUsd: Math.round(result.total_cost_usd * 100) / 100 } : {}),
    ...(result?.num_turns ? { turns: result.num_turns } : {}),
  }
  if (!result?.structured_output) session.error = (result?.result ?? stderr.trim().split("\n").slice(-3).join(" ")) || `Exited with code ${code}.`
  if (session.error && apiFailure.test(session.error)) throw new JudgeUnavailableError(`${name}: ${session.error.slice(0, 300)}`)
  return { output: result?.structured_output, session }
}

function checkList(checks: RubricCheck[]): string {
  return checks.map(check => `- ${check.id} (${check.major ? "major" : "minor"}, ${check.method}): ${check.text}`).join("\n")
}

const commonRules = (app: string, scratch: string, tag: string, config: JudgeConfig) => {
  const [alternatives, ...stack] = config.rules(app, scratch)
  return `Rules:
- The app's source is in ${app}. Don't change its source files. Write your own scripts and notes only in ${scratch}.
- ${alternatives}
- Outcomes: "pass", "fail", "na" (the check doesn't apply to this app; it counts as a pass), "unverified" (you can't check it here, such as a production-only behavior or a third-party key we don't have; say why).
- Evidence: one or two sentences. For a fail, name the file and line and quote the code, or give the request, the status and what came back. For a pass, say briefly what you saw. Be fair and strict: a check passes only when you saw it pass.
- Sources: the places in the app's code your verdict comes from, as \`{ path, line, endLine, quote }\` with \`path\` from the app's root and \`quote\` the exact text of the first line. A fail whose problem is in the code needs at least one; cite the lines with the problem, not the ones next to them. A fail in behavior alone (a page that doesn't render, a request that hangs) may have none. For a pass they are optional. At most 3, each one block of at most 30 lines.
- For a fail, also \`why\`: what's wrong and its effect, in one sentence. And \`fix\`: the concrete better way for this app, naming the ${config.apis} API to use, with a fenced code block of at most 12 lines when code says it best. When you aren't sure an API exists, describe the change in words.
- Run installs, builds and type checks through \`heavy <command>\` (the shared machine lock), for example \`heavy pnpm install\`. Use ports 4830-4899 for anything you start, never 3000. Save the PID of every server you start and stop it with \`kill <pid>\`. Never use \`pkill\`, \`killall\` or \`kill $(pgrep -f ...)\`: they match other graders and the grader itself.
- Put \`${tag}\` in the name of every Docker container, Compose project or Supabase project you start (for example \`${tag}-pg\`). The CLI removes them when grading ends, so the setup grader may leave the app's database running for the others.
- Browser checks: Chromium works through Playwright. In a .mjs file under ${scratch}, \`import { chromium } from ${JSON.stringify(playwrightEntry())}\`, then \`chromium.launch()\`. Run it with node.
${stack.map(rule => `- ${rule}\n`).join("")}- Answer every check listed below under its id in \`results\`, each exactly once.`
}

/** Whether the app's package.json depends on Nuxt, so Vite Doctor should have resolved its version. */
function usesNuxt(files: RunFile[]): boolean {
  return /"nuxt"\s*:/.test(files.find(file => file.path === "package.json")?.content ?? "")
}

/** Removes the Docker containers, volumes and networks the judge started for one app, found by the tag in their names. */
async function removeContainers(tag: string) {
  const docker = (...args: string[]) => promisify(execFile)("docker", args).then(({ stdout }) => stdout.split("\n").filter(Boolean), () => [])
  const containers = await docker("ps", "-aq", "--filter", `name=${tag}`)
  if (containers.length) await docker("rm", "-f", "-v", ...containers)
  const volumes = await docker("volume", "ls", "-q", "--filter", `name=${tag}`)
  if (volumes.length) await docker("volume", "rm", ...volumes)
  const networks = await docker("network", "ls", "-q", "--filter", `name=${tag}`)
  if (networks.length) await docker("network", "rm", ...networks)
}

/**
 * Grades one app against RUBRIC.md. A broken app scores 0; an app is never graded on a failed judge:
 * when the judge's API refuses a session, this throws JudgeUnavailableError.
 */
export async function judgeApp(options: JudgeOptions): Promise<RubricGrade> {
  const rubric = readRubric(options.project)
  const config = judgeConfig(options.project)
  if (!options.files.length) {
    const checks = rubric.checks.map(check => ({ id: check.id, outcome: "unverified" as const, evidence: "The run left no files." }))
    const { sections, score, rubricScore } = scoreRubric(rubric, checks, false)
    return { rubric: options.project, judge: { harness: "claude-code", model: judgeModel, effort: judgeEffort }, gradedAt: new Date().toISOString(), started: false, setupNotes: "The run left no files.", checks, sections, score, rubricScore, doctor: null, vibe: null, sessions: [] }
  }
  await ensureBrowser(options.log)
  const root = await mkdtemp(join(tmpdir(), "judge-"))
  const tag = `judge-${basename(root).slice(-6).toLowerCase()}`
  const app = join(root, "app")
  const scratch = join(root, "scratch")
  const home = join(root, "home")
  await mkdir(join(home, ".claude"), { recursive: true })
  await mkdir(scratch, { recursive: true })
  await mkdir(options.outDir, { recursive: true })
  for (const file of options.files) {
    await mkdir(dirname(join(app, file.path)), { recursive: true })
    await writeFile(join(app, file.path), fileBytes(file))
  }
  const sessionFile = join(scratch, "agent-session.md")
  await writeFile(sessionFile, options.sessionText ?? noSession)
  const promptFile = join(scratch, "PROMPT.md")
  await writeFile(promptFile, options.prompt)

  const sessions: JudgeSession[] = []
  const results = new Map<string, CheckResult>()
  // Places are checked against the app's files and moved to their quote. A fail keeps its sources even when empty; a pass
  // without any has none, so the explain step can still add them to the reference's passes.
  const take = (output: unknown, ids: string[], session: JudgeSession) => {
    const answers = (output as { results?: Record<string, { outcome: CheckResult["outcome"], evidence: string, sources?: RawSource[], why?: string, fix?: string }> } | undefined)?.results ?? {}
    for (const id of ids) {
      const answer = answers[id]
      if (!answer) {
        results.set(id, { id, outcome: "unverified", evidence: session.error ? `The judge failed: ${session.error.slice(0, 300)}` : "The judge returned no result for this check." })
        continue
      }
      const sources = resolveSources(options.files, answer.sources ?? [])
      results.set(id, {
        id,
        outcome: answer.outcome,
        evidence: answer.evidence.slice(0, 1200),
        ...(answer.outcome === "fail" ? { why: answer.why?.trim().slice(0, 600), fix: answer.fix?.trim().slice(0, 2000) } : {}),
        ...(answer.outcome === "fail" || sources.length ? { sources } : {}),
      })
    }
  }

  let server: ChildProcess | undefined
  let started = false
  let setupNotes = ""
  let doctor: DoctorGrade | null = null
  let vibe: VibeGrade | null = null

  // The vibe pass reads the code only, so it runs even when the app doesn't start.
  const referenceDir = join(scratch, "reference")
  for (const file of options.reference ?? []) {
    await mkdir(dirname(join(referenceDir, file.path)), { recursive: true })
    await writeFile(join(referenceDir, file.path), fileBytes(file))
  }
  const gradeVibe = async () => {
    options.log("judge vibe")
    const anchors = await readFile(join(tasksRoot, options.project, "VIBE.md"), "utf8")
    const graded = await askClaude("vibe", `You review the design of a web app that an AI coding agent built from the prompt in ${promptFile}. The app is in ${app}. Read its code; don't run it, and don't change it.

${anchors}

${options.reference ? `The reference app is in ${referenceDir}.` : "There is no other app to compare with here: score against the anchors alone."}

Return the score, a short summary, and the findings with the places in the app's code they are about (paths from the app's root, with the exact text of the first line as \`quote\`). Each finding says \`why\`: what's wrong and its effect, or for an elegant one what works. Every finding but an elegant one also says \`fix\`: the better way, naming the API to use. Cite at least five findings, the elegant ones included.`, vibeSchema(config.apis), app, home, options.outDir, 30 * 60_000, "Read,Glob,Grep")
    sessions.push(graded.session)
    const output = graded.output as { score: number, summary: string, findings: (Omit<VibeFinding, "text" | "sources"> & { sources: RawSource[] })[] } | undefined
    // `text` joins why and fix for the current view.
    const findings = output?.findings.map(finding => ({ ...finding, text: [finding.why, finding.fix].filter(Boolean).join(" "), sources: resolveSources(options.files, finding.sources) }))
    vibe = output && findings ? { score: Math.round(output.score * 10) / 10, summary: output.summary, findings } : null
    options.log(`judge vibe: ${vibe?.score ?? "-"} of 10 in ${Math.round(graded.session.durationMs / 60_000)} min${graded.session.error ? ` (${graded.session.error.slice(0, 200)})` : ""}`)
  }
  try {
    const port = await freePort(4830, 4899)
    const setupIds = config.setupChecks
    options.log(`judge setup: install, build, ${setupIds.join(", ")}`)
    const setup = await askClaude("setup", `You are the first grader of a web app that an AI coding agent built from the prompt in ${promptFile}. The rubric's rules:

${rubric.header}

Your job:
1. ${config.build}
2. ${config.setupGrading(port)}
${checkList(rubric.checks.filter(check => setupIds.includes(check.id)))}
3. Stop every server you started. Then report how to start the production server: the shell command (run from ${app}) in startCommand, and in env the literal values of settings the command doesn't load by itself (leave env empty when it reads .env; never put descriptions there). We start it ourselves with PORT, NITRO_PORT, HOST and NITRO_HOST set. Put what the other graders need to know in notes: settings you added, demo accounts and passwords if the app seeds any, where mail goes without a key, anything broken.
If the build fails, don't fix the app: report built=false, an empty startCommand, and why.

${commonRules(app, scratch, tag, config)}`, setupSchema(setupIds, config.apis), app, home, options.outDir, 40 * 60_000)
    sessions.push(setup.session)
    take(setup.output, setupIds, setup.session)
    const plan = setup.output as { built?: boolean, startCommand?: string, env?: Record<string, string>, notes?: string } | undefined
    setupNotes = [plan?.startCommand ? `Start: \`${plan.startCommand}\`` : "", plan?.notes ?? setup.session.error ?? ""].filter(Boolean).join("\n\n")

    // Doctor reads the installed app, so it runs once the setup grader has installed and built it.
    if (plan?.built) {
      options.log("judge: vite-doctor")
      const { report, note } = await runDoctor(app)
      doctor = scoreDoctor(report, note, options.doctorBaseline ?? [], usesNuxt(options.files))
      options.log(`judge: vite-doctor ${doctor.score ?? "-"} of 10 (${doctor.points} points${doctor.note ? `; ${doctor.note}` : ""})`)
    }

    const jobs: (() => Promise<void>)[] = [() => gradeVibe()]
    if (plan?.built && plan.startCommand) {
      const local = `http://127.0.0.1:${port}`
      // Graders browse at localhost: WebAuthn refuses an IP address as the passkey domain.
      const origin = `http://localhost:${port}`
      const logFile = createWriteStream(join(options.outDir, "server.log"))
      server = spawn("sh", ["-c", plan.startCommand], {
        cwd: app,
        env: { ...judgeEnv(home), ...plan.env, PORT: String(port), NITRO_PORT: String(port), HOST: "127.0.0.1", NITRO_HOST: "127.0.0.1", NODE_ENV: "production" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      })
      server.stdout?.pipe(logFile)
      server.stderr?.pipe(logFile)
      for (let attempt = 0; attempt < 60 && !started; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        started = await fetch(local, { redirect: "manual", signal: AbortSignal.timeout(5000) }).then(() => true, () => false)
      }
      options.log(`judge: server ${started ? `up at ${origin}` : "did not start"}`)
      if (started) {
        for (const group of config.groups) {
          jobs.unshift(async () => {
            const checks = rubric.checks.filter(check => group.sections.includes(check.section) && !setupIds.includes(check.id))
            const ids = checks.map(check => check.id)
            options.log(`judge ${group.name}: ${ids.length} checks`)
            const texts = group.sections.map(key => rubric.sectionText.get(key)).join("\n\n")
            const graded = await askClaude(group.name, `You grade part of the rubric for a web app that an AI coding agent built from the prompt in ${promptFile}. The rubric's rules:

${rubric.header}

${config.sharedServer(origin, group.name, app)}
Notes from the setup grader:
${setupNotes}

The agent's session log (its commands, notes and final message) is in ${sessionFile}. Grade the "log" checks from it. When it records no session, mark them na.

The sections you grade, as RUBRIC.md writes them (sources and notes included):

${texts}

Grade exactly these checks:
${checkList(checks)}

${commonRules(app, scratch, tag, config)}`, resultSchema(ids, config.apis), app, home, options.outDir, 50 * 60_000)
            sessions.push(graded.session)
            take(graded.output, ids, graded.session)
            options.log(`judge ${group.name}: done in ${Math.round(graded.session.durationMs / 60_000)} min${graded.session.error ? ` (${graded.session.error.slice(0, 200)})` : ""}`)
          })
        }
      }
    }
    await runJobs(jobs)
  }
  finally {
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM")
      }
      catch {}
    }
    await removeContainers(tag)
    await stopProcessesIn([root])
    await rm(root, { recursive: true, force: true }).catch(() => {})
  }

  const checks = rubric.checks.map(check => results.get(check.id) ?? { id: check.id, outcome: "unverified" as const, evidence: started ? "Not graded." : "The app did not build or start." })
  const { sections, score, rubricScore } = scoreRubric(rubric, checks, started, doctor?.score)
  return {
    rubric: options.project,
    judge: { harness: "claude-code", model: judgeModel, effort: judgeEffort },
    gradedAt: new Date().toISOString(),
    started,
    ...(setupNotes ? { setupNotes } : {}),
    checks,
    sections,
    score,
    rubricScore,
    doctor,
    vibe,
    sessions,
  }
}
