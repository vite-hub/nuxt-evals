// The rubric judge: Claude Code with Opus 5.5 grades a finished app against RUBRIC.md. It runs through CLIProxy, so it
// uses Maxi's Claude subscription, with an empty Claude config (no CLAUDE.md, skills, plugins, hooks or MCP servers).
//
// 1. Setup: one judge session installs, builds and checks the app the way its README says (P1, P3), then reports the
//    command that starts the production server.
// 2. The CLI starts that server once, on a fresh port.
// 3. Judge sessions grade the other sections, three at a time, against the running server and the code.
// 4. The CLI scores each section with the rubric's rules (site/shared/rubric.ts). The judge never picks a score.
//
// The judge is blind: it grades the reference app exactly like a run, from a folder with a neutral name, and never
// learns which app it has. The reference gets a session log that records no session, so its "log" checks come back n/a.
import { type ChildProcess, execFile, spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { promisify } from "node:util"
import type { AgentSession } from "@vite-hub/agent/sessions"
import type { RunFile } from "../../site/shared/report.ts"
import { type CheckResult, type JudgeSession, type RubricCheck, type RubricGrade, scoreRubric } from "../../site/shared/rubric.ts"
import { readRubric } from "../../tasks/meetups/rubric.ts"
import { cliRoot } from "./paths.ts"
import { stopProcessesIn } from "./workspace.ts"

export const judgeModel = "claude-opus-5-5"
export const judgeEffort = "high"
/** Grading sessions at once. Slimbook is shared: at most three agent sessions run at a time. */
const judgeParallel = Number(process.env.JUDGE_PARALLEL ?? 3)
/** The session log of an app no agent session built. */
const noSession = "# Session log\n\nNo agent session was recorded for this app.\n"

/** Sections each grading session takes. P1 and P3 restart the server, so the setup session grades them. */
export const groups: { name: string, sections: string[] }[] = [
  { name: "product", sections: ["P"] },
  { name: "data-state-ssr-server-vitehub", sections: ["D", "S", "H", "R", "I"] },
  { name: "db-auth-validation-cache-time-seo-security", sections: ["B", "A", "V", "C", "T", "E", "X"] },
  { name: "ui-vue-files-types-a11y-errors-deploy-agent", sections: ["U", "Q", "F", "Y", "W", "G", "K", "Z"] },
]
const setupChecks = ["P1", "P3"]

const resultSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          outcome: { type: "string", enum: ["pass", "fail", "na", "unverified"] },
          evidence: { type: "string" },
        },
        required: ["id", "outcome", "evidence"],
      },
    },
  },
  required: ["results"],
} as const

const setupSchema = {
  type: "object",
  properties: {
    built: { type: "boolean", description: "The production build finished." },
    startCommand: { type: "string", description: "Shell command, run from the app folder, that starts the production server. Empty when it can't start." },
    env: { type: "object", additionalProperties: { type: "string" }, description: "Literal values of environment variables the start command doesn't load by itself, beyond PORT, HOST and NITRO_PORT/NITRO_HOST. Empty when the command reads them from .env." },
    notes: { type: "string", description: "What the graders should know: env you set, demo accounts, seed data, the mail outbox, problems." },
    results: resultSchema.properties.results,
  },
  required: ["built", "startCommand", "env", "notes", "results"],
} as const

function playwrightEntry(): string {
  const manifest = createRequire(join(cliRoot, "package.json")).resolve("playwright-core/package.json")
  return join(dirname(manifest), "index.mjs")
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

interface JudgeOptions {
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
  const code = await new Promise<number | null>(resolve => child.on("close", resolve))
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
  return { output: result?.structured_output, session }
}

function checkList(checks: RubricCheck[]): string {
  return checks.map(check => `- ${check.id} (${check.major ? "major" : "minor"}, ${check.method}): ${check.text}`).join("\n")
}

const commonRules = (app: string, scratch: string, tag: string) => `Rules:
- The app's source is in ${app}. Don't change its source files. Write your own scripts and notes only in ${scratch}.
- Grade what the app does and how its code is written. Accept every correct alternative: useAsyncData instead of useFetch, plain HTML instead of a UI library. The prompt asks for ViteHub, but only section I grades whether the app uses it: elsewhere, grade the behavior and the code whatever library provides them. Never grade file layout for its own sake.
- Outcomes: "pass", "fail", "na" (the check doesn't apply to this app; it counts as a pass), "unverified" (you can't check it here, such as a production-only behavior or a third-party key we don't have; say why).
- Evidence: one or two sentences. For a fail, name the file and line and quote the code, or give the request, the status and what came back. For a pass, say briefly what you saw. Be fair and strict: a check passes only when you saw it pass.
- Run installs, builds and type checks through \`heavy <command>\` (the shared machine lock), for example \`heavy pnpm install\`. Use ports 4830-4899 for anything you start, never 3000. Save the PID of every server you start and stop it with \`kill <pid>\`. Never use \`pkill\`, \`killall\` or \`kill $(pgrep -f ...)\`: they match other graders and the grader itself.
- Put \`${tag}\` in the name of every Docker container, Compose project or Supabase project you start (for example \`${tag}-pg\`). The CLI removes them when grading ends, so the setup grader may leave the app's database running for the others.
- Browser checks: Chromium works through Playwright. In a .mjs file under ${scratch}, \`import { chromium } from ${JSON.stringify(playwrightEntry())}\`, then \`chromium.launch()\`. Run it with node.
- No third-party API keys are available (mail, exchange rates). A check that only needs a key to send is judged from the code and from what the app does without the key.
- Return every check id listed below exactly once.`

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

/** Grades one app against RUBRIC.md. Never throws for a broken app: it scores 1 in every section. */
export async function judgeApp(options: JudgeOptions): Promise<RubricGrade> {
  const rubric = readRubric()
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
    await writeFile(join(app, file.path), file.content)
  }
  const sessionFile = join(scratch, "agent-session.md")
  await writeFile(sessionFile, options.sessionText ?? noSession)
  const promptFile = join(scratch, "PROMPT.md")
  await writeFile(promptFile, options.prompt)

  const sessions: JudgeSession[] = []
  const results = new Map<string, CheckResult>()
  const take = (output: unknown, ids: string[], session: JudgeSession) => {
    const list = (output as { results?: CheckResult[] } | undefined)?.results ?? []
    for (const result of list) if (ids.includes(result.id)) results.set(result.id, { id: result.id, outcome: result.outcome, evidence: result.evidence.slice(0, 1200) })
    for (const id of ids) if (!results.has(id)) results.set(id, { id, outcome: "unverified", evidence: session.error ? `The judge failed: ${session.error.slice(0, 300)}` : "The judge returned no result for this check." })
  }

  let server: ChildProcess | undefined
  let started = false
  let setupNotes = ""
  try {
    const port = await freePort(4830, 4899)
    const setupIds = setupChecks
    options.log("judge setup: install, build, P1, P3")
    const setup = await askClaude("setup", `You are the first grader of a web app that an AI coding agent built from the prompt in ${promptFile}. The rubric's rules:

${rubric.header}

Your job:
1. Read the app's README and package.json. Install its dependencies, prepare a fresh database the way the README or scripts say, and make a production build (for Nuxt usually \`nuxt build\`, output in .output). If the app needs settings such as an auth secret, put generated values in a .env file in the app folder the way its README or .env.example says. Leave third-party keys unset.
2. Grade these checks. For P3, start the production server on port ${port} (set PORT, NITRO_PORT, HOST=127.0.0.1 and NITRO_HOST=127.0.0.1), sign up a user, restart the server, and see whether the session survives.
${checkList(rubric.checks.filter(check => setupIds.includes(check.id)))}
3. Stop every server you started. Then report how to start the production server: the shell command (run from ${app}) in startCommand, and in env the literal values of settings the command doesn't load by itself (leave env empty when it reads .env; never put descriptions there). We start it ourselves with PORT, NITRO_PORT, HOST and NITRO_HOST set. Put what the other graders need to know in notes: settings you added, demo accounts and passwords if the app seeds any, where mail goes without a key, anything broken.
If the build fails, don't fix the app: report built=false, an empty startCommand, and why.

${commonRules(app, scratch, tag)}`, setupSchema, app, home, options.outDir, 40 * 60_000)
    sessions.push(setup.session)
    take(setup.output, setupIds, setup.session)
    const plan = setup.output as { built?: boolean, startCommand?: string, env?: Record<string, string>, notes?: string } | undefined
    setupNotes = [plan?.startCommand ? `Start: \`${plan.startCommand}\`` : "", plan?.notes ?? setup.session.error ?? ""].filter(Boolean).join("\n\n")

    if (plan?.built && plan.startCommand) {
      const origin = `http://127.0.0.1:${port}`
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
        started = await fetch(origin, { redirect: "manual", signal: AbortSignal.timeout(5000) }).then(() => true, () => false)
      }
      options.log(`judge: server ${started ? `up at ${origin}` : "did not start"}`)
      if (started) {
        const queue = [...groups]
        const worker = async () => {
          for (let group = queue.shift(); group; group = queue.shift()) {
            const checks = rubric.checks.filter(check => group.sections.includes(check.section) && !setupIds.includes(check.id))
            const ids = checks.map(check => check.id)
            options.log(`judge ${group.name}: ${ids.length} checks`)
            const texts = group.sections.map(key => rubric.sectionText.get(key)).join("\n\n")
            const graded = await askClaude(group.name, `You grade part of the rubric for a web app that an AI coding agent built from the prompt in ${promptFile}. The rubric's rules:

${rubric.header}

The production build is running at ${origin} with a database only graders use. Don't stop, restart or rebuild it, and don't run \`nuxt build\`, \`nuxt prepare\` or migrations in ${app}. Other graders use the same server at the same time: make your own accounts with unique emails (judge-${group.name.split("-")[0]}-<n>@example.test) and your own events. The app may rate-limit sign-ups per client address; spread them out or wait when it answers 429.
Notes from the setup grader:
${setupNotes}

The agent's session log (its commands, notes and final message) is in ${sessionFile}. Grade the "log" checks from it. When it records no session, mark them na.

The sections you grade, as RUBRIC.md writes them (sources and notes included):

${texts}

Grade exactly these checks:
${checkList(checks)}

${commonRules(app, scratch, tag)}`, resultSchema, app, home, options.outDir, 50 * 60_000)
            sessions.push(graded.session)
            take(graded.output, ids, graded.session)
            options.log(`judge ${group.name}: done in ${Math.round(graded.session.durationMs / 60_000)} min${graded.session.error ? ` (${graded.session.error.slice(0, 200)})` : ""}`)
          }
        }
        await Promise.all(Array.from({ length: judgeParallel }, () => worker()))
      }
    }
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
  const { sections, score, rubricScore } = scoreRubric(rubric, checks, started)
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
    sessions,
  }
}
