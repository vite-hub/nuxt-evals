import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createError, defineHandler, readBody } from "h3"
import { streamAgent } from "vite-hub/agent"
import { getRuntimeContext } from "vite-hub/runtime/h3"
import type { RunReport } from "../../../site/shared/report"
import codexA from "../agents/codex-a"
import { summarizeEvents } from "../utils/events"
import { runDirectory, runHome, runsRoot } from "../utils/run-directory"
import { writeSummary } from "../utils/summary"
import { tasks } from "../utils/tasks"
import { diffWorkingCopy, prepareWorkingCopy, readPrompt, readWorkingCopy } from "../utils/working-copy"

interface RunRequest {
  task: string
  suite?: string
  repeat?: number
}

/** Run one task once with Codex in setup A, grade it, store the report, and post it to the site. */
export default defineHandler(async (event) => {
  const body = await readBody<RunRequest>(event)
  const task = body?.task ? tasks[body.task] : undefined
  if (!task) throw createError({ status: 400, message: `Unknown task. Known: ${Object.keys(tasks).join(", ")}` })

  const startedAt = new Date()
  const repeat = body.repeat ?? 1
  const id = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${task.id}-codex-a-${repeat}`
  const directory = runDirectory(id)
  await prepareWorkingCopy(task.id, directory, runHome(id))

  const events: unknown[] = []
  let failure: string | undefined
  try {
    const stream = await streamAgent(codexA, getRuntimeContext(event), {
      prompt: await readPrompt(task.id),
      context: { invoker: { id, kind: "eval", label: `${task.id} #${repeat}` } },
    }, { output: "events" })
    if (!isAsyncIterable(stream)) throw new Error("Expected an Agent event stream.")
    for await (const item of stream) events.push(item)
  }
  catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }

  const files = await readWorkingCopy(directory)
  const diff = await diffWorkingCopy(directory)
  const changed = new Set([...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(match => match[1]))
  const source = files.filter(file => changed.has(file.path)).map(file => file.content).join("\n")
  const probes = await Promise.all(task.probes.map(async probe => ({
    id: probe.id,
    title: probe.title,
    layer: probe.layer,
    passed: await probe.check({ files, source }),
  })))
  const summary = summarizeEvents(events)
  const gatePassed = probes.filter(probe => probe.layer === "gate").every(probe => probe.passed)
  const score = gatePassed ? probes.filter(probe => probe.passed).length / probes.length : 0

  const prompt = await readPrompt(task.id)
  const report: RunReport = {
    id,
    prompt,
    suite: body.suite ?? "v0-dummy",
    task: task.id,
    agent: "codex",
    model: "gpt-6-luna",
    reasoning: "low",
    setup: "A",
    repeat,
    status: failure ? "error" : gatePassed ? "passed" : "failed",
    score,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    usage: summary.usage,
    probes,
    diagnostics: { ...summary.diagnostics, ...(failure ? { error: failure } : {}) },
    finalText: summary.finalText,
    events,
    diff,
    files,
  }

  try {
    report.summary = await writeSummary(report, prompt)
  }
  catch (error) {
    report.diagnostics.error = [report.diagnostics.error, `Summary failed: ${error instanceof Error ? error.message : String(error)}`].filter(Boolean).join(" ")
  }

  await mkdir(join(runsRoot, id), { recursive: true })
  await writeFile(join(runsRoot, id, "report.json"), JSON.stringify(report, null, 2))
  const posted = await postReport(report)
  return { id, status: report.status, score, posted, usage: report.usage, diagnostics: report.diagnostics }
})

async function postReport(report: RunReport): Promise<string> {
  const site = process.env.SITE_URL
  if (!site) return "skipped: SITE_URL is empty"
  try {
    const response = await fetch(new URL("/api/runs", site), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.INGEST_TOKEN ?? ""}` },
      body: JSON.stringify(report),
    })
    return response.ok ? "posted" : `failed: ${response.status} ${(await response.text()).slice(0, 300)}`
  }
  catch (error) {
    return `failed: ${error instanceof Error ? error.message : String(error)}`
  }
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value
}
