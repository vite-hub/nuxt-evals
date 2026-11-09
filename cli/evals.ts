// nuxt-evals CLI. Runs agent CLIs locally, stores each run in .data/runs/<id>, and pushes runs to the site.
//   pnpm evals run <project> [--harness codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--parallel <n>] [--setup A|B|C] [--suite <name>] [--no-summary]
//   pnpm evals regrade <id|all>      grades saved runs again with the current probes
//   pnpm evals judge <id|all|reference>  grades rubric runs (or the project's reference app) with the Opus judge
//   pnpm evals summarize <id|all>
//   pnpm evals push <id|all>
//   pnpm evals base <project>       posts the starting app, prompt and probes as the head of Workspace `main`
//   pnpm evals skills <project>     refreshes the skill snapshots of setups B and C in setups/
//   pnpm evals list
//   pnpm evals reset --yes          deletes every run on the site (rows, sessions, Workspace refs stay in history, summaries)
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { readAgentSession } from "@vite-hub/agent/sessions"
import type { BaseUpload, Harness, RunFile, RunRecord, RunUpload } from "../site/shared/report.ts"
import type { RubricGrade } from "../site/shared/rubric.ts"
import { readRubric } from "../tasks/meetups-v2/rubric.ts"
import { defaultSettings, runAgentCli } from "./lib/agents.ts"
import { audit, diagnose, gradeProbes, score, tasks } from "./lib/grade.ts"
import { judgeApp, sessionLog } from "./lib/judge.ts"
import { runFolder, runsRoot, tasksRoot } from "./lib/paths.ts"
import { prepareWorkingCopy } from "./lib/prepare.ts"
import { priceUsage } from "./lib/pricing.ts"
import { auditExpectation, installSetup, planSetup, refreshSkills, type Setup, type SetupPlan, setups } from "./lib/setups.ts"
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
    "no-judge": { type: "boolean", default: false },
    "project": { type: "string", default: "meetups-v2" },
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

async function runOnce(task: (typeof tasks)[string], harness: Harness, settings: ReturnType<typeof settingsFor>, plan: SetupPlan, prompt: string, stamp: string, repeat: number): Promise<void> {
  const startedAt = new Date()
  const id = `${stamp}-${task.id}-${harness}-${plan.setup.toLowerCase()}${repeat}`
  const folder = runFolder(id)
  await ensureFolder(folder)
  const sandbox = await createSandbox(task.id)
  console.log(`${id}: running ${harness} ${settings.model} (${settings.reasoning}), setup ${plan.setup}`)
  try {
    await prepareWorkingCopy(task.id, sandbox.work, sandbox.home)
    await installSetup(plan, harness, sandbox.home)
    const exit = await runAgentCli({ prompt, work: sandbox.work, home: sandbox.home, settings, mcpServers: plan.mcpServers, port: 4900 + setups.indexOf(plan.setup) * 10 + repeat, streamFile: join(folder, "stream.jsonl") })
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
      setup: plan.setup,
      repeat,
      status: error ? "error" : graded.gatePassed ? "passed" : "failed",
      score: graded.score,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      usage: await priceUsage(harness, model, session.usage),
      probes,
      diagnostics: {
        ...diagnose(session),
        audit: audit(session, sessionText, await readText(join(folder, "stream.jsonl")) ?? "", sandbox.work, await auditExpectation(plan, harness, sandbox.home)),
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
    if (task.rubric && !values["no-judge"]) await judge(id)
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
  if (!setups.includes(values.setup as Setup)) throw new Error(`Unknown setup ${values.setup}. Use A, B or C.`)
  const plan = await planSetup(values.setup as Setup, task.id)
  const settings = settingsFor(harness)
  const prompt = await readPrompt(task.id)
  const stamp = batchStamp(new Date())
  const pending = Array.from({ length: Number(values.repeat) }, (_, index) => index + 1)
  const workers = Array.from({ length: Math.max(1, Math.min(Number(values.parallel), pending.length)) }, async () => {
    for (let repeat = pending.shift(); repeat !== undefined; repeat = pending.shift()) {
      await runOnce(task, harness, settings, plan, prompt, stamp, repeat).catch((error: unknown) => {
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

/** Grades a finished run again with the current probes, from its saved files. For probe fixes; the agent doesn't run again. */
async function regrade(id: string): Promise<void> {
  const folder = runFolder(id)
  const run = JSON.parse(await readFile(join(folder, "run.json"), "utf8")) as RunRecord
  const task = tasks[run.project]
  if (!task) throw new Error(`Unknown project ${run.project}.`)
  const files = JSON.parse(await readFile(join(folder, "files.json"), "utf8")) as RunFile[]
  const diff = await readText(join(folder, "diff.patch")) ?? ""
  const sandbox = await createSandbox(task.id)
  try {
    // The saved files are the whole working copy, so fixture files the agent deleted go too.
    for (const entry of await readdir(sandbox.work)) if (entry !== ".git") await rm(join(sandbox.work, entry), { recursive: true, force: true })
    for (const file of files) {
      await mkdir(dirname(join(sandbox.work, file.path)), { recursive: true })
      await writeFile(join(sandbox.work, file.path), file.content)
    }
    await prepareWorkingCopy(task.id, sandbox.work, sandbox.home)
    const probes = await gradeProbes(task, files, diff, sandbox.work, line => console.log(`${id}: ${line}`))
    const graded = score(probes)
    const status = run.status === "error" ? "error" : graded.gatePassed ? "passed" : "failed"
    const session = readAgentSession(run.harness, await readFile(join(folder, "session.jsonl"), "utf8"))
    const diagnostics = { ...run.diagnostics, ...diagnose(session) }
    await writeFile(join(folder, "run.json"), JSON.stringify({ ...run, probes, score: graded.score, status, diagnostics }, null, 2))
    console.log(`${id}: ${Math.round(run.score * 100)}% → ${Math.round(graded.score * 100)}%`)
  }
  finally {
    await sandbox.remove()
  }
}

/** Grades a rubric run with the Opus judge from its saved files and session, and stores the grade in run.json. */
async function judge(id: string): Promise<void> {
  const loaded = await loadRun(id)
  if (!tasks[loaded.run.project]?.rubric) return console.log(`${id}: ${loaded.run.project} has no rubric.`)
  const grade = await judgeApp({
    label: id,
    files: loaded.files,
    prompt: loaded.prompt,
    sessionText: sessionLog(loaded.session, loaded.run.finalText),
    outDir: join(loaded.folder, "judge"),
    log: line => console.log(`${id}: ${line}`),
  })
  const status = loaded.run.status === "error" ? "error" : grade.started ? "passed" : "failed"
  await writeFile(join(loaded.folder, "run.json"), JSON.stringify({ ...loaded.run, rubric: grade, score: grade.score / 5, status }, null, 2))
  console.log(`${id}: rubric ${grade.score} of 5 (${grade.sections.map(section => `${section.key}${section.score ?? "-"}`).join(" ")})`)
}

/** Grades the project's reference app, the yardstick runs are compared with. Writes tasks/<project>/reference-grade.json. */
async function judgeReference(project: string): Promise<void> {
  const files = await readWorkingCopy(join(tasksRoot, project, "reference"))
  const grade = await judgeApp({ label: `${project}-reference`, files, prompt: await readPrompt(project), outDir: join(runsRoot, "..", "reference", project, "judge"), log: line => console.log(`reference: ${line}`) })
  await writeFile(join(tasksRoot, project, "reference-grade.json"), `${JSON.stringify(grade, null, 2)}\n`)
  console.log(`reference: rubric ${grade.score} of 5 (${grade.sections.map(section => `${section.key}${section.score ?? "-"}`).join(" ")})`)
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

/** Posts the project's starting app, prompt and probes. The site makes them the head of Workspace `main`. */
async function pushBase(taskId: string | undefined): Promise<void> {
  const site = process.env.SITE_URL
  if (!site) throw new Error("Set SITE_URL in cli/.env.")
  const task = taskId ? tasks[taskId] : undefined
  if (!task) throw new Error(`Unknown project. Known: ${Object.keys(tasks).join(", ")}`)
  const reference = task.rubric ? JSON.parse(await readText(join(tasksRoot, task.id, "reference-grade.json")) ?? "null") as RubricGrade | null : null
  const rubric = task.rubric ? readRubric() : undefined
  const upload: BaseUpload = {
    title: task.title,
    prompt: await readPrompt(task.id),
    probes: task.probes.map(probe => ({ id: probe.id, title: probe.title, layer: probe.layer, ...(probe.why ? { why: probe.why } : {}) })),
    // A rubric project starts empty; its page shows the reference app.
    files: await readWorkingCopy(join(tasksRoot, task.id, task.rubric ? "reference" : "fixture")),
    ...(rubric ? { rubric: { sections: rubric.sections, checks: rubric.checks } } : {}),
    ...(reference ? { reference } : {}),
  }
  const response = await fetch(new URL(`/api/projects/${task.id}/base`, site), {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.INGEST_TOKEN ?? ""}` },
    body: JSON.stringify(upload),
  })
  const body = await response.text()
  console.log(`${task.id}: ${response.status} ${response.ok ? body : body.slice(0, 300)}`)
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
else if (command === "regrade") for (const id of await selectRuns(target)) await regrade(id)
else if (command === "judge" && target === "reference") await judgeReference(values.project!)
else if (command === "judge") {
  for (const id of await selectRuns(target)) {
    if (target !== "all" || id.includes(values.project!)) await judge(id)
  }
}
else if (command === "summarize") for (const id of await selectRuns(target)) await summarize(id)
else if (command === "push") for (const id of await selectRuns(target)) await push(id)
else if (command === "base") await pushBase(target)
else if (command === "skills") await refreshSkills(target ?? "meetups")
else if (command === "list") await list()
else if (command === "reset") await reset()
else {
  console.log("Usage: pnpm evals run <project> [--harness codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--parallel <n>] [--no-summary]")
  console.log("       pnpm evals summarize <id|all> | push <id|all> | list | reset --yes")
  process.exitCode = command ? 1 : 0
}
