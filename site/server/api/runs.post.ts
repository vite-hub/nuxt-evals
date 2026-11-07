import { createError, defineHandler, readBody } from "h3"
import { streamAgent } from "vite-hub/agent"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database/drizzle"
import { getRuntimeContext } from "vite-hub/runtime/h3"
import type { RunReport } from "../../shared/report"
import codexA from "../agents/codex-a"
import { content } from "../content"
import { requireIngestToken } from "../utils/ingest"
import { invocationRecordId, openRelay, relayRunId } from "../utils/relay"

/** The runner posts one graded run. The site keeps the row, the artifacts, the Agent session and the summary. */
export default defineHandler(async (event) => {
  requireIngestToken(event)
  const report = await readBody<RunReport>(event)
  if (!report?.id || !/^[\w.-]+$/.test(report.id)) throw createError({ status: 400, message: "A run report needs an id." })
  const { events, diff, files, summary, prompt, ...row } = report

  const [error] = await blob.put(`runs/${report.id}.json`, JSON.stringify({ events, diff, files }), { contentType: "application/json" })
  if (error) throw error

  // Replay the events into the relay Agent, so the run is a session in the Console.
  openRelay(report.id, events)
  const stream = await streamAgent(codexA, getRuntimeContext(event), {
    prompt: prompt ?? report.task,
    context: { invoker: { id: report.id, kind: "eval", label: `${report.task} #${report.repeat}` } },
  }, { output: "events" })
  if (stream && typeof stream === "object" && Symbol.asyncIterator in stream) for await (const _ of stream as AsyncIterable<unknown>) { /* drain */ }
  const runId = relayRunId(report.id)
  const invocation = runId ? await invocationRecordId("codex-a", runId) : null

  const { db, schema } = useDatabase("default")
  const values = { ...row, invocation }
  await db.insert(schema.runs).values(values).onConflictDoUpdate({ target: schema.runs.id, set: values })

  if (summary) {
    const runs = content.collection("runs")
    await runs.save(report.id, {
      data: { title: `${report.task} #${report.repeat}`, task: report.task, agent: report.agent, model: report.model, setup: report.setup, score: report.score, status: report.status, startedAt: report.startedAt, ...(invocation ? { invocation } : {}) },
      body: summary,
    }, { message: `Summary of ${report.id}` })
    await content.publish({ collection: "runs", ids: [report.id], message: `Publish ${report.id}` })
  }
  return { id: report.id, invocation, summary: Boolean(summary) }
})
