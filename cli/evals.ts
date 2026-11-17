// nuxt-evals CLI. Runs agent CLIs locally, stores each run in .data/runs/<id>, and pushes runs to the site.
//   pnpm evals run <project> [--agent opus|fable|sol] [--harness codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--parallel <n>] [--setup A|B|C] [--suite <name>] [--no-summary]
//   pnpm evals regrade <id|all>      grades saved runs again with the current probes
//   pnpm evals judge <id|all|reference>  grades rubric runs (or the project's reference app) with the Opus judge
//   pnpm evals explain <id|all|reference>  adds a fix and code places to the checks of an existing grade
//   pnpm evals rescore <id|all|reference>  scores stored grades again with the current RUBRIC.md, without the judge
//   pnpm evals summarize <id|all>
//   pnpm evals push <id|all>
//   pnpm evals base <project>       posts the starting app, prompt and probes as the head of Workspace `main`
//   pnpm evals skills <project>     refreshes the skill snapshots of setups B, C and V in setups/
//   pnpm evals list
//   pnpm evals operate <task|all> [--driver browser|bridge|both] [--agent opus|sol] [--repeat <n>] [--parallel <n>] [--batch <stamp>]
//   pnpm evals operate-report [--batch <stamp>]
//   pnpm evals tasks [project]      loads every project definition, checks its prompt and starting files, prints its probes and target
//   pnpm evals admit <project>      builds a fix project's reference and starting app and runs its scripted checks on both
//   pnpm evals unpush <id>          removes one run from the site; the local folder stays
//   pnpm evals reset --yes          deletes every run on the site (rows, sessions, Workspace refs stay in history, summaries)
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { createWriteStream, existsSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { readAgentSession } from "@vite-hub/agent/sessions"
import type { BaseUpload, Harness, RunFile, RunRecord, RunUpload } from "../site/shared/report.ts"
import { type RubricGrade, scoreRubric } from "../site/shared/rubric.ts"
import { readRubric } from "../tasks/rubric.ts"
import { type AgentSettings, agentName, modelSet, resolveSettings, runAgentCli } from "./lib/agents.ts"
import { audit, diagnose, gradeProbes, score, tasks } from "./lib/grade.ts"
import { type ExplainStats, explainGrade } from "./lib/explain.ts"
import { referenceBaseline } from "./lib/doctor.ts"
import { bestFixDiff, fixtureFolder, referenceFolder } from "./lib/fixtures.ts"
import { JudgeUnavailableError, judgeApp, judgeUnavailableExit, sessionLog } from "./lib/judge.ts"
import { runFolder, runsRoot, tasksRoot } from "./lib/paths.ts"
import { installDependencies, prepareWorkingCopy, runHeavy } from "./lib/prepare.ts"
import { freePort, scriptedContext, startServer } from "./lib/serve.ts"
import { buildPreviewSnapshot } from "./lib/preview.ts"
import { ensureOperateApp, operateGroups, readOperateRuns, runOperate } from "./lib/operate.ts"
import { priceUsage } from "./lib/pricing.ts"
import { type OperateDriver, operateTasks } from "../tasks/vitehub-ui/operate/tasks.ts"
import { auditExpectation, installSetup, planSetup, refreshSkills, type Setup, type SetupPlan, setups, snapshotHash } from "./lib/setups.ts"
import { digest, writeSummary } from "./lib/summary.ts"
import { createSandbox, diffWorkingCopy, ensureFolder, fileBytes, readPrompt, readWorkingCopy, textFiles } from "./lib/workspace.ts"

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "agent": { type: "string" },
    "harness": { type: "string" },
    "model": { type: "string" },
    "reasoning": { type: "string" },
    "repeat": { type: "string", default: "1" },
    "parallel": { type: "string", default: "1" },
    "yes": { type: "boolean", default: false },
    "setup": { type: "string", default: "A" },
    "suite": { type: "string", default: "pilot-1" },
    "no-summary": { type: "boolean", default: false },
    "no-judge": { type: "boolean", default: false },
    "no-explain": { type: "boolean", default: false },
    "no-preview": { type: "boolean", default: false },
    "project": { type: "string", default: "meetups" },
    "driver": { type: "string", default: "both" },
    "batch": { type: "string" },
  },
})
const [command, target] = positionals

/** Fix and scan projects start from an app, so their runs are graded on what the agent changed. */
function startsFromApp(project: string): boolean {
  const kind = tasks[project]?.kind
  return kind === "fix" || kind === "scan"
}

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

async function runOnce(task: (typeof tasks)[string], harness: Harness, settings: AgentSettings, plan: SetupPlan, prompt: string, stamp: string, repeat: number): Promise<void> {
  const startedAt = new Date()
  // The agent's name from the model set (`opus`), or the model id: two agents of one harness can run in the same minute.
  const agent = agentName(settings)
  const id = `${stamp}-${task.id}-${agent}-${plan.setup.toLowerCase()}${repeat}`
  const folder = runFolder(id)
  await ensureFolder(folder)
  const sandbox = await createSandbox(task.id)
  console.log(`${id}: running ${harness} ${settings.model} (${settings.reasoning}), setup ${plan.setup}`)
  try {
    await prepareWorkingCopy(task.id, sandbox.work, sandbox.home)
    const installed = await installSetup(plan, harness, sandbox.home, sandbox.work, task.skills)
    const exit = await runAgentCli({ prompt, work: sandbox.work, home: sandbox.home, settings, mcpServers: plan.mcpServers, skills: installed.skills, ...(task.timeLimitMinutes ? { timeoutMs: task.timeLimitMinutes * 60_000 } : {}), port: 4900 + Math.max(0, Object.keys(modelSet).indexOf(agent)) * 25 + setups.indexOf(plan.setup) * 8 + repeat, streamFile: join(folder, "stream.jsonl") })
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
        audit: { ...audit(session, sessionText, await readText(join(folder, "stream.jsonl")) ?? "", sandbox.work, await auditExpectation(installed, harness, sandbox.home)), ...(plan.skillsDir ? { skillsHash: await snapshotHash(plan) } : {}) },
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

async function run(taskId: string | undefined): Promise<void> {
  const task = taskId ? tasks[taskId] : undefined
  if (!task) throw new Error(`Unknown project. Known: ${Object.keys(tasks).join(", ")}`)
  if (task.pending) throw new Error(`${task.id} can't run yet: ${task.pending}`)
  const settings = resolveSettings(values)
  const harness = settings.harness
  if (!setups.includes(values.setup as Setup)) throw new Error(`Unknown setup ${values.setup}. Use ${setups.join(", ")}.`)
  const plan = await planSetup(values.setup as Setup, task.id)
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
      await writeFile(join(sandbox.work, file.path), fileBytes(file))
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
  const project = loaded.run.project === "meetups-v2" ? "meetups" : loaded.run.project
  const grade = await judgeApp({
    label: id,
    project,
    files: loaded.files,
    prompt: loaded.prompt,
    sessionText: sessionLog(loaded.session, loaded.run.finalText),
    outDir: join(loaded.folder, "judge"),
    reference: await readWorkingCopy(await referenceFolder(project)),
    doctorBaseline: await referenceBaseline(join(tasksRoot, project, "reference-grade.json")),
    ...(startsFromApp(project) ? { diff: loaded.diff } : {}),
    log: line => console.log(`${id}: ${line}`),
  })
  const status = loaded.run.status === "error" ? "error" : grade.started ? "passed" : "failed"
  await writeFile(join(loaded.folder, "run.json"), JSON.stringify({ ...loaded.run, project, rubric: grade, score: grade.score / 10, status }, null, 2))
  console.log(`${id}: ${grade.score} of 10, doctor ${grade.doctor?.score ?? "-"}, vibe ${grade.vibe?.score ?? "-"} (${grade.sections.map(section => `${section.key}${section.score ?? "-"}`).join(" ")})`)
  if (!values["no-explain"]) await explain(id)
}

/** Grades the project's reference app, the yardstick runs are compared with. Writes tasks/<project>/reference-grade.json. */
async function judgeReference(project: string): Promise<void> {
  const files = await readWorkingCopy(await referenceFolder(project))
  // A planted project's reference is the fixed app: the judge sees the best fix as its changes.
  const diff = startsFromApp(project) ? await bestFixDiff(project) : undefined
  const grade = await judgeApp({ label: `${project}-reference`, project, files, prompt: await readPrompt(project), outDir: join(runsRoot, "..", "reference", project, "judge"), ...(diff !== undefined ? { diff } : {}), log: line => console.log(`reference: ${line}`) })
  await writeFile(join(tasksRoot, project, "reference-grade.json"), `${JSON.stringify(grade, null, 2)}\n`)
  console.log(`reference: ${grade.score} of 10, doctor ${grade.doctor?.score ?? "-"}, vibe ${grade.vibe?.score ?? "-"} (${grade.sections.map(section => `${section.key}${section.score ?? "-"}`).join(" ")})`)
  if (!values["no-explain"]) await explainReference(project)
}

/** Scores a stored grade again from its check outcomes with the current RUBRIC.md and scoring rules. The judge doesn't run. */
function rescoreGrade(grade: RubricGrade, project: string): RubricGrade {
  const rubric = readRubric(project)
  const byId = new Map(grade.checks.map(check => [check.id, check]))
  const checks = rubric.checks.map(check => byId.get(check.id) ?? { id: check.id, outcome: "unverified" as const, evidence: "Not graded: the check is newer than this grade." })
  const { sections, score, rubricScore, gateFailed } = scoreRubric(rubric, checks, grade.started, grade.doctor?.score)
  const { gateFailed: _old, ...rest } = grade
  return { ...rest, rubric: project, checks, sections, score, rubricScore, ...(gateFailed ? { gateFailed } : {}) }
}

/** `rescore <id|all|reference>`: new scores from stored outcomes. Runs of the old `meetups-v2` id become `meetups`. */
async function rescore(selector: string | undefined): Promise<void> {
  if (selector === "reference") {
    const file = join(tasksRoot, values.project!, "reference-grade.json")
    const grade = rescoreGrade(JSON.parse(await readFile(file, "utf8")) as RubricGrade, values.project!)
    await writeFile(file, `${JSON.stringify(grade, null, 2)}\n`)
    return console.log(`reference: ${grade.score} of 10`)
  }
  for (const id of await selectRuns(selector)) {
    const file = join(runFolder(id), "run.json")
    const run = JSON.parse(await readFile(file, "utf8")) as RunRecord
    if (!run.rubric) continue
    const project = run.project === "meetups-v2" ? "meetups" : run.project
    const rubric = rescoreGrade(run.rubric, project)
    await writeFile(file, JSON.stringify({ ...run, project, rubric, score: rubric.score / 10 }, null, 2))
    console.log(`${id}: ${rubric.score} of 10`)
  }
}

function explainReport(label: string, stats: ExplainStats) {
  console.log(`${label}: explained ${stats.explained} checks, ${stats.fixes} fixes, ${stats.withSources} with sources (${stats.sources} places, ${stats.dropped.length} dropped), ${Math.round(stats.durationMs / 60_000)} min, $${stats.costUsd}`)
  for (const line of stats.dropped) console.log(`${label}: dropped ${line}`)
  for (const { id, note } of stats.disagreements) console.log(`${label}: ${id} explainer disagrees: ${note}`)
}

/**
 * Adds `fix` and `sources` to the failed checks of a run's grade. Outcomes, evidence and scores stay. The fixes take
 * their APIs from the project's reference app.
 */
async function explain(id: string): Promise<void> {
  const folder = runFolder(id)
  const file = join(folder, "run.json")
  const run = JSON.parse(await readText(file) ?? "null") as RunRecord | null
  if (!run?.rubric) return console.log(`${id}: no rubric grade, skipped.`)
  const files = JSON.parse(await readFile(join(folder, "files.json"), "utf8")) as RunFile[]
  const reference = await readWorkingCopy(await referenceFolder(run.project))
  const { grade, stats } = await explainGrade({ label: id, files, reference, grade: run.rubric, outcomes: ["fail"], outDir: join(folder, "judge"), log: line => console.log(`${id}: ${line}`) })
  // Read the run again: a push or a summary may have written it while the sessions ran.
  if (stats.explained) await writeFile(file, JSON.stringify({ ...JSON.parse(await readFile(file, "utf8")) as RunRecord, rubric: grade }, null, 2))
  explainReport(id, stats)
}

/** Adds `sources` to the reference grade's passes, the code the site shows next to a run's fail, and `fix` and `sources` to its fails. */
async function explainReference(project: string): Promise<void> {
  const file = join(tasksRoot, project, "reference-grade.json")
  const reference = JSON.parse(await readFile(file, "utf8")) as RubricGrade
  const files = await readWorkingCopy(await referenceFolder(project))
  const { grade, stats } = await explainGrade({ label: `${project}-reference`, files, grade: reference, outcomes: ["fail", "pass"], outDir: join(runsRoot, "..", "reference", project, "judge"), log: line => console.log(`reference: ${line}`) })
  if (stats.explained) await writeFile(file, `${JSON.stringify(grade, null, 2)}\n`)
  explainReport("reference", stats)
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

/** Builds the app's Preview snapshot and uploads its parts, then its manifest, under `previews/<scope>/<id>/`. */
async function pushPreview(site: string, scope: "runs" | "projects", id: string, files: RunFile[]): Promise<void> {
  const started = Date.now()
  const { sha256, parts } = await buildPreviewSnapshot(files)
  const put = async (name: string, body: Uint8Array | string, type: string) => {
    const response = await fetch(new URL(`/api/previews/${scope}/${id}/${name}`, site), {
      method: "PUT",
      headers: { "content-type": type, "authorization": `Bearer ${process.env.INGEST_TOKEN ?? ""}` },
      body,
    })
    if (!response.ok) throw new Error(`Preview ${name}: ${response.status} ${(await response.text()).slice(0, 200)}`)
  }
  for (const [index, part] of parts.entries()) await put(`${sha256}.${index}.bin`, part, "application/octet-stream")
  await put("manifest.json", JSON.stringify({ sha256, parts: parts.length }), "application/json")
  console.log(`${id}: preview snapshot ${Math.round(parts.reduce((sum, part) => sum + part.length, 0) / 1e6)} MB in ${parts.length} parts, ${Math.round((Date.now() - started) / 1000)} s`)
}

async function push(id: string): Promise<void> {
  const site = process.env.SITE_URL
  if (!site) throw new Error("Set SITE_URL in cli/.env.")
  const loaded = await loadRun(id)
  if (!loaded.run.usage.costUsd) {
    loaded.run.usage = await priceUsage(loaded.run.harness, loaded.run.model, loaded.run.usage)
    if (loaded.run.usage.costUsd) await writeFile(join(loaded.folder, "run.json"), JSON.stringify(loaded.run, null, 2))
  }
  // A rubric project's Workspace `main` holds its reference app, so its runs send no starting files: a fixture there
  // (Meal planner's recipe data) would become the head of `main` and hide the reference. Its files are in the run's own.
  // A fix or scan project's `main` is its starting app, so a run's diff there is the agent's change.
  const fixture = startsFromApp(loaded.run.project) || !tasks[loaded.run.project]?.rubric ? await fixtureFolder(loaded.run.project) : undefined
  const base = fixture ? await readWorkingCopy(fixture) : []
  // The site's Workspace keeps text; images and fonts stay in the run folder (and in the Preview snapshot's build).
  const upload: RunUpload = { run: loaded.run, prompt: loaded.prompt, session: loaded.sessionText, diff: loaded.diff, files: textFiles(loaded.files), base: textFiles(base), ...(loaded.summary ? { summary: loaded.summary } : {}) }
  const response = await fetch(new URL("/api/runs", site), {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.INGEST_TOKEN ?? ""}` },
    body: JSON.stringify(upload),
  })
  const body = await response.text()
  console.log(`${id}: ${response.status} ${response.ok ? body : body.slice(0, 300)}`)
  if (!response.ok) return void (process.exitCode = 1)
  if (!values["no-preview"]) await pushPreview(site, "runs", id, loaded.files).catch((error: unknown) => console.error(`${id}: preview snapshot failed: ${error instanceof Error ? error.message : String(error)}`))
}

/** Posts the project's starting app, prompt and probes. The site makes them the head of Workspace `main`. */
async function pushBase(taskId: string | undefined): Promise<void> {
  const site = process.env.SITE_URL
  if (!site) throw new Error("Set SITE_URL in cli/.env.")
  const task = taskId ? tasks[taskId] : undefined
  if (!task) throw new Error(`Unknown project. Known: ${Object.keys(tasks).join(", ")}`)
  const reference = task.rubric ? JSON.parse(await readText(join(tasksRoot, task.id, "reference-grade.json")) ?? "null") as RubricGrade | null : null
  const rubric = task.rubric ? readRubric(task.id) : undefined
  const upload: BaseUpload = {
    title: task.title,
    prompt: await readPrompt(task.id),
    probes: task.probes.map(probe => ({ id: probe.id, title: probe.title, layer: probe.layer, ...(probe.why ? { why: probe.why } : {}) })),
    // A build project with a rubric starts empty; its page shows the reference app. A fix or scan project shows the app
    // the agent gets, and for a fix the best fix as a patch.
    files: textFiles(await readWorkingCopy(task.rubric && !startsFromApp(task.id) ? await referenceFolder(task.id) : (await fixtureFolder(task.id))!)),
    kind: task.kind ?? "build",
    ...(task.kind === "fix" ? { bestFix: await bestFixDiff(task.id) } : {}),
    ...(rubric ? { rubric: { sections: rubric.sections, checks: rubric.checks, ...(rubric.gate ? { gate: rubric.gate } : {}), ...(rubric.weights ? { weights: rubric.weights } : {}) } } : {}),
    ...(reference ? { reference } : {}),
  }
  const response = await fetch(new URL(`/api/projects/${task.id}/base`, site), {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.INGEST_TOKEN ?? ""}` },
    body: JSON.stringify(upload),
  })
  const body = await response.text()
  console.log(`${task.id}: ${response.status} ${response.ok ? body : body.slice(0, 300)}`)
  if (!response.ok) return void (process.exitCode = 1)
  if (!values["no-preview"]) await pushPreview(site, "projects", task.id, upload.files).catch((error: unknown) => console.error(`${task.id}: preview snapshot failed: ${error instanceof Error ? error.message : String(error)}`))
}

/**
 * Loads every project definition and checks what a run needs: its prompt, its starting files or reference, unique
 * probe ids and a target between 0 and 1. Prints one line per project. Runs no agent and grades nothing.
 */
async function listTasks(only: string | undefined): Promise<void> {
  const selected = only ? [tasks[only]].filter(task => task !== undefined) : Object.values(tasks)
  if (!selected.length && !(only && operateTasks[only])) throw new Error(`Unknown project. Known: ${Object.keys(tasks).join(", ")}`)
  for (const task of selected) {
    const problems: string[] = []
    if (!(await readText(join(tasksRoot, task.id, "PROMPT.md")))?.trim()) problems.push("no PROMPT.md")
    const start = task.rubric && !startsFromApp(task.id) ? await referenceFolder(task.id) : (await fixtureFolder(task.id)) ?? join(tasksRoot, task.id, "fixture")
    if (task.rubric || task.fixture) {
      if (!(await readdir(start).catch(() => [])).length) problems.push(`no files in ${start.slice(tasksRoot.length + 1)}`)
    }
    if (!task.rubric && !task.probes.length) problems.push("no probes")
    const ids = task.probes.map(probe => probe.id)
    if (new Set(ids).size !== ids.length) problems.push("duplicate probe ids")
    if (task.target !== undefined && !(task.target > 0 && task.target <= 1)) problems.push(`target ${task.target} is not in (0, 1]`)
    if (problems.length) process.exitCode = 1
    const grading = task.rubric ? "rubric" : `${task.probes.length} probes (${["gate", "runtime", "static"].map(layer => `${task.probes.filter(probe => probe.layer === layer).length} ${layer}`).join(", ")})`
    const parts = [
      task.id,
      grading,
      task.plant ? `${task.kind ?? "build"} on ${task.plant.base}` : task.rubric ? "reference" : `fixture ${start.slice(tasksRoot.length + 1)}`,
      task.target === undefined ? "no target" : `target ${Math.round(task.target * 100)}%`,
      task.pending ? `pending: ${task.pending}` : "runnable",
      ...problems.map(problem => `PROBLEM: ${problem}`),
    ]
    console.log(parts.join(" · "))
  }
  if (only && !operateTasks[only]) return
  for (const task of Object.values(operateTasks)) {
    if (only && task.id !== only) continue
    const target = task.target ? `target: bridge success >= browser, page calls <= ${task.target.toolCallsAtMost}x, page chars <= ${Math.round(task.target.charsAtMost * 100) / 100}x` : "no target"
    console.log([task.id, "operate (app state)", "app vitehub-ui/operate/app", target, "runnable"].join(" · "))
  }
}

/**
 * `operate <task|all>`: an agent works the running ui-sdk app with each driver, `--repeat` times. Runs of one driver
 * and agent go `--parallel` at a time; drivers run one after the other, so they meet the same machine load.
 */
async function operate(selector: string | undefined): Promise<void> {
  const picked = selector === "all" ? Object.values(operateTasks) : [operateTasks[selector ?? ""]].filter(task => task !== undefined)
  if (!picked.length) throw new Error(`Name an operate task or all. Known: ${Object.keys(operateTasks).join(", ")}`)
  const drivers: OperateDriver[] = values.driver === "both" ? ["browser", "bridge"] : [values.driver as OperateDriver]
  if (drivers.some(driver => driver !== "browser" && driver !== "bridge")) throw new Error("Use --driver browser, bridge or both.")
  const settings = resolveSettings(values)
  const stamp = values.batch ?? batchStamp(new Date())
  await ensureOperateApp()
  for (const task of picked) {
    for (const driver of drivers) {
      const pending = Array.from({ length: Number(values.repeat) }, (_, index) => index + 1)
      await Promise.all(Array.from({ length: Math.max(1, Math.min(Number(values.parallel), pending.length)) }, async () => {
        for (let repeat = pending.shift(); repeat !== undefined; repeat = pending.shift()) {
          await runOperate(task, driver, settings, stamp, repeat).catch((error: unknown) => {
            console.error(`${task.id} ${driver} ${repeat} failed: ${error instanceof Error ? error.stack : String(error)}`)
            process.exitCode = 1
          })
        }
      }))
    }
  }
}

/** `operate-report [--batch <stamp>]`: per task, driver and agent, the success rate and medians. */
async function operateReport(): Promise<void> {
  const groups = await operateGroups(await readOperateRuns(values.batch))
  console.log("task | agent | driver | passed | page calls (all) | page chars (all) | s | tokens | cost")
  for (const group of groups) {
    console.log(`${group.task} | ${group.agent} | ${group.driver} | ${group.passed}/${group.runs} | ${group.pageCalls} (${group.toolCalls}) | ${group.pageChars} (${group.chars}) | ${group.seconds} | ${group.tokens} | $${group.costUsd.toFixed(3)}`)
  }
}

async function list(): Promise<void> {
  for (const id of await listRuns()) {
    const run = JSON.parse(await readText(join(runFolder(id), "run.json")) ?? "null") as RunRecord | null
    if (!run) continue
    const summary = await readText(join(runFolder(id), "summary.md"))
    console.log(`${id}  ${run.status.padEnd(6)} ${String(Math.round(run.score * 100)).padStart(3)}%  ${run.harness} ${run.model}  $${run.usage.costUsd ?? "?"}${summary ? "  summary" : ""}`)
  }
}

/** Removes one run from the site. The local folder stays. */
async function unpush(id: string): Promise<void> {
  const site = process.env.SITE_URL
  if (!site) throw new Error("Set SITE_URL in cli/.env.")
  const response = await fetch(new URL(`/api/runs/${encodeURIComponent(id)}`, site), { method: "DELETE", headers: { authorization: `Bearer ${process.env.INGEST_TOKEN ?? ""}` } })
  console.log(`${id}: ${response.status} ${await response.text()}`)
  if (!response.ok) process.exitCode = 1
}

async function reset(): Promise<void> {
  const site = process.env.SITE_URL
  if (!site) throw new Error("Set SITE_URL in cli/.env.")
  if (!values.yes) throw new Error(`This deletes every run on ${site}. Run it again with --yes.`)
  const response = await fetch(new URL("/api/runs", site), { method: "DELETE", headers: { authorization: `Bearer ${process.env.INGEST_TOKEN ?? ""}` } })
  console.log(`${response.status} ${await response.text()}`)
  if (!response.ok) process.exitCode = 1
}

/**
 * `admit <project>`: proves a planted project's scripted checks before any agent runs on it. It builds the reference
 * (the fixed app) and the starting app (the planted one) the way the Meetups README says, starts each, and runs the
 * checks: the reference must pass every gate check, the starting app must fail at least one.
 */
async function admit(project: string | undefined): Promise<void> {
  const task = project ? tasks[project] : undefined
  const scripted = task?.judge?.scripted
  if (!task || !scripted) throw new Error("Name a project with scripted checks.")
  const gate = readRubric(task.id).gate ?? []
  const outcomes: Record<string, Record<string, string>> = {}
  for (const [label, folder] of [["reference", await referenceFolder(task.id)], ["planted", (await fixtureFolder(task.id))!]] as const) {
    const root = await mkdtemp(join(tmpdir(), `admit-${label}-`))
    const app = join(root, "app")
    const scratch = join(root, "scratch")
    await mkdir(scratch, { recursive: true })
    await cp(folder, app, { recursive: true })
    const log = (line: string) => console.log(`${task.id} ${label}: ${line}`)
    const serverLog = createWriteStream(join(root, "server.log"))
    let served: Awaited<ReturnType<typeof startServer>>
    try {
      log(`install: ${await installDependencies(task.id, app)}`)
      await writeFile(join(app, ".env"), `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\n`)
      const env = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NUXT_TELEMETRY_DISABLED: "1" }
      await runHeavy([join(app, "node_modules/.bin/nuxt"), "build"], { cwd: app, env, timeoutMs: 900_000 })
      log("built")
      // Meetups migrates its database with the ViteHub CLI; an app without ViteHub has nothing to migrate.
      if (existsSync(join(app, "node_modules/.bin/vitehub"))) await runHeavy([join(app, "node_modules/.bin/vitehub"), "db", "migrate"], { cwd: app, env, timeoutMs: 300_000 })
      const command = "node --env-file-if-exists=.env .output/server/index.mjs"
      const serverEnv = { ...env, ...task.judge!.serverEnv }
      served = await startServer({ app, command, env: serverEnv, port: await freePort(4830, 4899), log: serverLog })
      if (!served) throw new Error(`The server did not start; see ${join(root, "server.log")}.`)
      const { context, stopAll } = scriptedContext({ served, app, scratch, command, env: serverEnv, log, serverLog })
      const found = await scripted.run(context).finally(stopAll)
      outcomes[label] = Object.fromEntries(scripted.checks.map(id => [id, found[id]?.outcome ?? "missing"]))
      for (const id of scripted.checks) log(`${id} ${found[id]?.outcome ?? "missing"}: ${found[id]?.evidence ?? ""}`)
    }
    finally {
      await served?.stop()
      serverLog.end()
      if (!process.env.ADMIT_KEEP) await rm(root, { recursive: true, force: true }).catch(() => {})
      else log(`kept ${root}`)
    }
  }
  const referencePasses = gate.every(id => outcomes.reference?.[id] === "pass" || !scripted.checks.includes(id))
  const plantFails = gate.some(id => outcomes.planted?.[id] === "fail")
  console.log(`${task.id}: reference ${referencePasses ? "passes" : "FAILS"} the gate, the planted app ${plantFails ? "fails" : "PASSES"} it: ${referencePasses && plantFails ? "admitted" : "NOT admitted"}`)
  if (!referencePasses || !plantFails) process.exitCode = 1
}

/** When the judge's API refuses a session, nothing is written: stop with exit 75 so a script can try again later. */
async function unlessJudgeUnavailable(task: () => Promise<void>): Promise<void> {
  try {
    await task()
  }
  catch (error) {
    if (!(error instanceof JudgeUnavailableError)) throw error
    console.error(`The judge is unavailable, nothing was written: ${error.message}`)
    process.exit(judgeUnavailableExit)
  }
}

if (command === "run") await run(target)
else if (command === "regrade") for (const id of await selectRuns(target)) await regrade(id)
else if (command === "judge" && target === "reference") await unlessJudgeUnavailable(() => judgeReference(values.project!))
else if (command === "judge") {
  for (const id of await selectRuns(target)) {
    if (target !== "all" || id.includes(values.project!)) await unlessJudgeUnavailable(() => judge(id))
  }
}
else if (command === "explain" && target === "reference") await unlessJudgeUnavailable(() => explainReference(values.project!))
else if (command === "explain") {
  for (const id of await selectRuns(target)) {
    if (target !== "all" || id.includes(values.project!)) await unlessJudgeUnavailable(() => explain(id))
  }
}
else if (command === "rescore") await rescore(target)
else if (command === "summarize") for (const id of await selectRuns(target)) await summarize(id)
else if (command === "push") for (const id of await selectRuns(target)) await push(id)
else if (command === "base") await pushBase(target)
else if (command === "skills") {
  if (!target) throw new Error("Usage: pnpm evals skills <project>")
  await refreshSkills(target)
}
else if (command === "list") await list()
else if (command === "tasks") await listTasks(target)
else if (command === "operate") await operate(target)
else if (command === "operate-report") await operateReport()
else if (command === "admit") await admit(target)
else if (command === "unpush") await unpush(target)
else if (command === "reset") await reset()
else {
  console.log("Usage: pnpm evals run <project> [--harness codex|claude-code] [--model <id>] [--reasoning <effort>] [--repeat <n>] [--parallel <n>] [--no-summary]")
  console.log("       pnpm evals judge <id|all|reference> | explain <id|all|reference>")
  console.log("       pnpm evals summarize <id|all> | push <id|all> | list | tasks [project] | reset --yes")
  process.exitCode = command ? 1 : 0
}
