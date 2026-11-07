import { createError, defineHandler, readBody } from "h3"
import { importAgentSession, readAgentSession } from "@vite-hub/agent/sessions"
import { createDatabaseAgentInvocationStore } from "vite-hub/agent/invocations/database"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database/drizzle"
import type { RunUpload } from "../../shared/report"
import { content } from "../content"
import { requireIngestToken } from "../utils/ingest"

/**
 * `evals push` posts one graded run. The site keeps the row, the raw session and the workspace in Blob, the session
 * as an Agent Invocation for the Console, and the summary in Content.
 */
export default defineHandler(async (event) => {
  requireIngestToken(event)
  const upload = await readBody<RunUpload>(event)
  const run = upload?.run
  if (!run?.id || !/^[\w.-]+$/.test(run.id)) throw createError({ status: 400, message: "A run needs an id." })
  if (run.agent !== "codex" && run.agent !== "claude-code") throw createError({ status: 400, message: "Unknown agent." })
  if (typeof upload.session !== "string") throw createError({ status: 400, message: "A run needs its session file." })

  for (const [key, body, contentType] of [
    [`runs/${run.id}/session.jsonl`, upload.session, "application/x-ndjson"],
    [`runs/${run.id}.json`, JSON.stringify({ diff: upload.diff, files: upload.files }), "application/json"],
  ] as const) {
    const [error] = await blob.put(key, body, { contentType })
    if (error) throw error
  }

  const session = readAgentSession(run.agent, upload.session)
  const imported = await importAgentSession(createDatabaseAgentInvocationStore(), session, {
    agentName: run.agent,
    runId: run.id,
    title: `${run.task} #${run.repeat}, setup ${run.setup}`,
    invoker: { id: run.id, kind: "eval", label: `nuxt-evals ${run.suite}` },
    annotations: { task: run.task, setup: run.setup, score: run.score, status: run.status },
  })

  const { db, schema } = useDatabase("default")
  const values = { ...run, invocation: imported.id }
  await db.insert(schema.runs).values(values).onConflictDoUpdate({ target: schema.runs.id, set: values })

  if (upload.summary) {
    await content.collection("runs").save(run.id, {
      data: { title: `${run.task} #${run.repeat}`, task: run.task, agent: run.agent, model: run.model, setup: run.setup, score: run.score, status: run.status, startedAt: run.startedAt, invocation: imported.id },
      body: upload.summary,
    }, { message: `Summary of ${run.id}` })
    await content.publish({ collection: "runs", ids: [run.id], message: `Publish ${run.id}` })
  }
  return { id: run.id, invocation: imported.id, replaced: imported.replaced, steps: session.steps.length, summary: Boolean(upload.summary) }
})
