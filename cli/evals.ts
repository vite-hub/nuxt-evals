// nuxt-evals CLI. Runs agent CLIs locally, stores each run in .data/runs/<id>, and pushes runs to the site.
//   pnpm evals run <project> [--harness codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--parallel <n>] [--setup A] [--suite <name>] [--no-summary]
//   pnpm evals summarize <id|all>
//   pnpm evals push <id|all>
//   pnpm evals list
//   pnpm evals reset --yes          deletes every run on the site (rows, sessions, Workspace refs stay in history, summaries)
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { readAgentSession } from "@vite-hub/agent/sessions"
import type { Harness, RunFile, RunRecord, RunUpload } from "../site/shared/report.ts"
import { defaultSettings, runAgentCli } from "./lib/agents.ts"
import { audit, diagnose, gradeProbes, score, tasks } from "./lib/grade.ts"
import { runFolder, runsRoot, tasksRoot } from "./lib/paths.ts"
import { prepareWorkingCopy } from "./lib/prepare.ts"
import { priceUsage } from "./lib/pricing.ts"
import { digest, writeSummary } from "./lib/summary.ts"
import { createSandbox, diffWorkingCopy, ensureFolder, readPrompt, readWorkingCopy } from "./lib/workspace.ts"

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "harness": { type: "string", default: "codex" },
    "model": { type: "string" },
    "reasoning": { type: "string" },
    "repeat": { type: "string", default: "1" },
    "parallel": { type: "string", default: "1" },
    "yes": { type: "boolean", default: false },
    "setup": { type: "string", default: "A" },
    "suite": { type: "string", default: "pilot-1" },
    "no-summary": { type: "boolean", default: false },
  },
})
const [command, target] = positionals

async function readText(path: string): Promise<string | undefined> {
  return await readFile(path, "utf8").catch(() => undefined)
}

async function listRuns(): Promise<string[]> {
  return (await readdir(runsRoot).catch(() => [])).filter(name => !name.startsWith(".")).sort()
}

async function selectRuns(selector: string | undefined): Promise<string[]> {
  if (!selector) throw new Error("Name a run id, or all.")
  return selector === "all" ? await listRuns() : [selector]
}

/** `20261107-1612`: runs of one batch share it, so they sort together. */
function batchStamp(date: Date): string {
  return date.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-")
}

async function runOnce(task: (typeof tasks)[string], harness: Harness, settings: ReturnType<typeof settingsFor>, prompt: string, stamp: string, repeat: number): Promise<void> {
  const startedAt = new Date()
  const id = `${stamp}-${task.id}-${harness}-${values.setup!.toLowerCase()}${repeat}`
  const folder = runFolder(id)
  await ensureFolder(folder)
  const sandbox = await createSandbox(task.id)
  console.log(`${id}: running ${harness} ${settings.model} (${settings.reasoning})`)
  try {
    await prepareWorkingCopy(task.id, sandbox.work, sandbox.home)
    const exit = await runAgentCli({ prompt, work: sandbox.work, home: sandbox.home, settings, port: 4900 + repeat, streamFile: join(folder, "stream.jsonl") })
    const sessionText = exit.sessionFile ? await readFile(exit.sessionFile, "utf8") : ""
    const session = readAgentSession(harness, sessionText)
    const files = await readWorkingCopy(sandbox.work)
    const diff = await diffWorkingCopy(sandbox.work)
    const probes = await gradeProbes(task, files, diff, sandbox.work, line => console.log(`${id}: ${line}`))
    const graded = score(probes)
    const error = exit.error ?? (sessionText ? session.error : "The agent wrote no session file.")
    const model = session.model ?? settings.model
    const record: RunRecord = {
      id,
      suite: values.suite!,
      project: task.id,
      harness,
      model,
      reasoning: session.reasoningEffort ?? settings.reasoning,
      setup: "A",
      repeat,
      status: error ? "error" : graded.gatePassed ? "passed" : "failed",
      score: graded.score,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      usage: await priceUsage(harness, model, session.usage),
      probes,
      diagnostics: {
        ...diagnose(session),
        audit: audit(session, sessionText, await readText(join(folder, "stream.jsonl")) ?? "", sandbox.work),
        ...(error ? { error } : {}),
      },
      finalText: session.text ?? "",
    }
    await writeFile(join(folder, "session.jsonl"), sessionText)
    await writeFile(join(folder, "prompt.md"), prompt)
    await writeFile(join(folder, "diff.patch"), diff)
    await writeFile(join(folder, "files.json"), JSON.stringify(files, null, 2))
    await writeFile(join(folder, "run.json"), JSON.stringify(record, null, 2))
    const auditNote = record.diagnostics.audit?.passed ? "audit ok" : `audit: ${record.diagnostics.audit?.problems.join(" ")}`
    console.log(`${id}: ${record.status}, score ${Math.round(record.score * 100)}%, ${session.steps.length} steps, $${record.usage.costUsd ?? "?"}, ${auditNote}`)
    if (!values["no-summary"]) await summarize(id)
  }
  finally {
    await sandbox.remove()
  }
}

function settingsFor(harness: Harness) {
  return { ...defaultSettings[harness], ...(values.model ? { model: values.model } : {}), ...(values.reasoning ? { reasoning: values.reasoning } : {}) }
}

async function run(taskId: string | undefined): Promise<void> {
  const task = taskId ? tasks[taskId] : undefined
  if (!task) throw new Error(`Unknown project. Known: ${Object.keys(tasks).join(", ")}`)
  const harness = values.harness as Harness
  if (!defaultSettings[harness]) throw new Error(`Unknown harness ${harness}. Use codex or claude-code.`)
  if (values.setup !== "A") throw new Error("Only setup A (bare) exists so far.")
  const settings = settingsFor(harness)
  const prompt = await readPrompt(task.id)
  const stamp = batchStamp(new Date())
  const pending = Array.from({ length: Number(values.repeat) }, (_, index) => index + 1)
  const workers = Array.from({ length: Math.max(1, Math.min(Number(values.parallel), pending.length)) }, async () => {
    for (let repeat = pending.shift(); repeat !== undefined; repeat = pending.shift()) {
      await runOnce(task, harness, settings, prompt, stamp, repeat).catch((error: unknown) => {
        console.error(`repeat ${repeat} failed: ${error instanceof Error ? error.stack : String(error)}`)
        process.exitCode = 1
      })
    }
  })
  await Promise.all(workers)
}

async function loadRun(id: string) {
  const folder = runFolder(id)
  const run = JSON.parse(await readFile(join(folder, "run.json"), "utf8")) as RunRecord
  const sessionText = await readFile(join(folder, "session.jsonl"), "utf8")
  return {
    folder,
    run,
    sessionText,
    session: readAgentSession(run.harness, sessionText),
    prompt: await readFile(join(folder, "prompt.md"), "utf8"),
    diff: await readText(join(folder, "diff.patch")) ?? "",
    files: JSON.parse(await readText(join(folder, "files.json")) ?? "[]") as RunFile[],
    summary: await readText(join(folder, "summary.md")),
  }
}

async function summarize(id: string): Promise<void> {
  const loaded = await loadRun(id)
  try {
    const summary = await writeSummary(digest(loaded.run, loaded.prompt, loaded.session, loaded.diff))
    await writeFile(join(loaded.folder, "summary.md"), summary)
    console.log(`${id}: summary written (${summary.length} characters)`)
  }
  catch (error) {
    console.error(`${id}: summary failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function push(id: string): Promise<void> {
  const site = process.env.SITE_URL
  if (!site) throw new Error("Set SITE_URL in cli/.env.")
  const loaded = await loadRun(id)
  if (!loaded.run.usage.costUsd) loaded.run.usage = await priceUsage(loaded.run.harness, loaded.run.model, loaded.run.usage)
  const base = await readWorkingCopy(join(tasksRoot, loaded.run.project, "fixture"))
  const upload: RunUpload = { run: loaded.run, prompt: loaded.prompt, session: loaded.sessionText, diff: loaded.diff, files: loaded.files, base, ...(loaded.summary ? { summary: loaded.summary } : {}) }
  const response = await fetch(new URL("/api/runs", site), {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.INGEST_TOKEN ?? ""}` },
    body: JSON.stringify(upload),
  })
  const body = await response.text()
  console.log(`${id}: ${response.status} ${response.ok ? body : body.slice(0, 300)}`)
  if (!response.ok) process.exitCode = 1
}

async function list(): Promise<void> {
  for (const id of await listRuns()) {
    const run = JSON.parse(await readText(join(runFolder(id), "run.json")) ?? "null") as RunRecord | null
    if (!run) continue
    const summary = await readText(join(runFolder(id), "summary.md"))
    console.log(`${id}  ${run.status.padEnd(6)} ${String(Math.round(run.score * 100)).padStart(3)}%  ${run.harness} ${run.model}  $${run.usage.costUsd ?? "?"}${summary ? "  summary" : ""}`)
  }
}

async function reset(): Promise<void> {
  const site = process.env.SITE_URL
  if (!site) throw new Error("Set SITE_URL in cli/.env.")
  if (!values.yes) throw new Error(`This deletes every run on ${site}. Run it again with --yes.`)
  const response = await fetch(new URL("/api/runs", site), { method: "DELETE", headers: { authorization: `Bearer ${process.env.INGEST_TOKEN ?? ""}` } })
  console.log(`${response.status} ${await response.text()}`)
  if (!response.ok) process.exitCode = 1
}

if (command === "run") await run(target)
else if (command === "summarize") for (const id of await selectRuns(target)) await summarize(id)
else if (command === "push") for (const id of await selectRuns(target)) await push(id)
else if (command === "list") await list()
else if (command === "reset") await reset()
else {
  console.log("Usage: pnpm evals run <project> [--harness codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--parallel <n>] [--no-summary]")
  console.log("       pnpm evals summarize <id|all> | push <id|all> | list | reset --yes")
  process.exitCode = command ? 1 : 0
}
