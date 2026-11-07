// nuxt-evals CLI. Runs agent CLIs locally, stores each run in .data/runs/<id>, and pushes runs to the site.
//   pnpm evals run <task> [--agent codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--setup A] [--no-summary]
//   pnpm evals summarize <id|all>
//   pnpm evals push <id|all>
//   pnpm evals list
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { readAgentSession } from "@vite-hub/agent/sessions"
import type { AgentName, RunFile, RunRecord, RunUpload } from "../site/shared/report.ts"
import { defaultSettings, runAgentCli } from "./lib/agents.ts"
import { audit, diagnose, gradeProbes, score, tasks } from "./lib/grade.ts"
import { runFolder, runsRoot } from "./lib/paths.ts"
import { digest, writeSummary } from "./lib/summary.ts"
import { createSandbox, diffWorkingCopy, ensureFolder, readPrompt, readWorkingCopy } from "./lib/workspace.ts"

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "agent": { type: "string", default: "codex" },
    "model": { type: "string" },
    "reasoning": { type: "string" },
    "repeat": { type: "string", default: "1" },
    "setup": { type: "string", default: "A" },
    "suite": { type: "string", default: "v0-dummy" },
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

async function run(taskId: string | undefined): Promise<void> {
  const task = taskId ? tasks[taskId] : undefined
  if (!task) throw new Error(`Unknown task. Known: ${Object.keys(tasks).join(", ")}`)
  const agent = values.agent as AgentName
  if (!defaultSettings[agent]) throw new Error(`Unknown agent ${agent}. Use codex or claude-code.`)
  if (values.setup !== "A") throw new Error("Only setup A (bare) exists so far.")
  const settings = { ...defaultSettings[agent], ...(values.model ? { model: values.model } : {}), ...(values.reasoning ? { reasoning: values.reasoning } : {}) }
  const prompt = await readPrompt(task.id)

  for (let repeat = 1; repeat <= Number(values.repeat); repeat++) {
    const startedAt = new Date()
    const id = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${task.id}-${agent}-${values.setup}-${repeat}`
    const folder = runFolder(id)
    await ensureFolder(folder)
    const sandbox = await createSandbox(task.id)
    console.log(`${id}: running ${agent} ${settings.model} (${settings.reasoning})`)
    try {
      const exit = await runAgentCli({ prompt, work: sandbox.work, home: sandbox.home, settings, streamFile: join(folder, "stream.jsonl") })
      const sessionText = exit.sessionFile ? await readFile(exit.sessionFile, "utf8") : ""
      const session = readAgentSession(agent, sessionText)
      const files = await readWorkingCopy(sandbox.work)
      const diff = await diffWorkingCopy(sandbox.work)
      const probes = await gradeProbes(task, files, diff)
      const graded = score(probes)
      const error = exit.error ?? (sessionText ? session.error : "The agent wrote no session file.")
      const record: RunRecord = {
        id,
        suite: values.suite!,
        task: task.id,
        agent,
        model: session.model ?? settings.model,
        reasoning: session.reasoningEffort ?? settings.reasoning,
        setup: "A",
        repeat,
        status: error ? "error" : graded.gatePassed ? "passed" : "failed",
        score: graded.score,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        usage: session.usage,
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
      console.log(`${id}: ${record.status}, score ${Math.round(record.score * 100)}%, ${session.steps.length} steps, ${auditNote}`)
      if (!values["no-summary"]) await summarize(id)
    }
    finally {
      await sandbox.remove()
    }
  }
}

async function loadRun(id: string) {
  const folder = runFolder(id)
  const run = JSON.parse(await readFile(join(folder, "run.json"), "utf8")) as RunRecord
  const sessionText = await readFile(join(folder, "session.jsonl"), "utf8")
  return {
    folder,
    run,
    sessionText,
    session: readAgentSession(run.agent, sessionText),
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
  const upload: RunUpload = { run: loaded.run, prompt: loaded.prompt, session: loaded.sessionText, diff: loaded.diff, files: loaded.files, ...(loaded.summary ? { summary: loaded.summary } : {}) }
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
    console.log(`${id}  ${run.status.padEnd(6)} ${String(Math.round(run.score * 100)).padStart(3)}%  ${run.agent} ${run.model}${summary ? "  summary" : ""}`)
  }
}

if (command === "run") await run(target)
else if (command === "summarize") for (const id of await selectRuns(target)) await summarize(id)
else if (command === "push") for (const id of await selectRuns(target)) await push(id)
else if (command === "list") await list()
else {
  console.log("Usage: pnpm evals run <task> [--agent codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--no-summary]")
  console.log("       pnpm evals summarize <id|all> | push <id|all> | list")
  process.exitCode = command ? 1 : 0
}
