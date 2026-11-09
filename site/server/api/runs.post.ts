import { createError, defineHandler, readBody } from "h3"
import { importAgentSession, readAgentSession } from "@vite-hub/agent/sessions"
import { createDatabaseAgentInvocationStore } from "vite-hub/agent/invocations/database"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database/drizzle"
import { consoleAgentName, type RunRecord, type RunUpload } from "../../shared/report"
import { harnessLabel, modelLabel, projectLabel } from "../../shared/labels"
import { content } from "../content"
import { requireIngestToken } from "../utils/ingest"
import { baseRevisions, fileMap, fixtureHash, projectWorkspaces, writableProjectWorkspace } from "../utils/project-workspace"

/**
 * The run's working copy goes on a ref named after the run. Its starting files are a `main` revision: the one with the
 * same fixture, or a new one when `evals push` brings a starting app the site has not seen. The run records which.
 */
async function commitWorkspace(run: RunRecord, upload: RunUpload) {
  if (!projectWorkspaces.has(run.project) || !upload.base?.length) return
  const workspace = writableProjectWorkspace(run.project)
  const base = fileMap(upload.base)
  const fixture = await fixtureHash(base)
  let main = (await baseRevisions(workspace)).find(revision => revision.metadata?.fixture === fixture)
  if (!main) {
    const head = await workspace.history.head()
    main = await workspace.history.commit({ ifHead: head?.id ?? null, files: base, message: "Starting app", metadata: { fixture } })
  }
  const head = await workspace.history.head({ ref: run.id })
  const revision = await workspace.history.commit({
    ref: run.id,
    ifHead: head?.id ?? null,
    files: fileMap(upload.files),
    message: `${harnessLabel(run.harness)} ${modelLabel(run.model)} ${run.reasoning}, setup ${run.setup} #${run.repeat}`,
    metadata: { run: run.id, harness: run.harness, model: run.model, setup: run.setup, score: run.score, base: main.id },
  })
  return { name: run.project, ref: run.id, revision: revision.id, base: main.id }
}

/**
 * `evals push` posts one graded run. The site keeps the row, the raw session in Blob, the working copy in the
 * project's Workspace, the session as an Invocation of `coding-agent` for the Console, and the summary in Content.
 */
export default defineHandler(async (event) => {
  requireIngestToken(event)
  const upload = await readBody<RunUpload>(event)
  const run = upload?.run
  if (!run?.id || !/^[\w.-]+$/.test(run.id)) throw createError({ status: 400, message: "A run needs an id." })
  if (run.harness !== "codex" && run.harness !== "claude-code") throw createError({ status: 400, message: "Unknown harness." })
  if (typeof upload.session !== "string") throw createError({ status: 400, message: "A run needs its session file." })

  const [error] = await blob.put(`runs/${run.id}/session.jsonl`, upload.session, { contentType: "application/x-ndjson" })
  if (error) throw error
  const workspace = await commitWorkspace(run, upload)

  const session = readAgentSession(run.harness, upload.session)
  const audit = run.diagnostics.audit
  const title = `${projectLabel(run.project)} · ${harnessLabel(run.harness)} ${modelLabel(run.model)} ${run.reasoning} · ${run.setup}${run.repeat}`
  const imported = await importAgentSession(createDatabaseAgentInvocationStore(), session, {
    agentName: consoleAgentName,
    runId: run.id,
    title,
    invoker: { id: run.id, kind: "eval", label: `nuxt-evals ${run.suite}` },
    annotations: {
      project: run.project,
      harness: run.harness,
      model: run.model,
      reasoning: run.reasoning,
      setup: run.setup,
      repeat: run.repeat,
      score: run.score,
      status: run.status,
    },
    configuration: {
      skills: (audit?.skills ?? []).map(name => ({ name })),
      mcpServers: (audit?.mcpServers ?? []).map(name => ({ name })),
      ...(workspace ? { workspace } : {}),
    },
    ...(run.usage.costUsd ? { cost: { usd: run.usage.costUsd, estimated: true, source: run.usage.costSource ?? "models.dev" } } : {}),
  })

  const { db, schema } = useDatabase("default")
  const values = { ...run, invocation: imported.id }
  await db.insert(schema.runs).values(values).onConflictDoUpdate({ target: schema.runs.id, set: values })

  if (upload.summary) {
    await content.collection("runs").save(run.id, {
      data: { title, project: run.project, harness: run.harness, model: run.model, setup: run.setup, score: run.score, status: run.status, startedAt: run.startedAt, invocation: imported.id },
      body: upload.summary,
    }, { message: `Summary of ${run.id}` })
    await content.publish({ collection: "runs", ids: [run.id], message: `Publish ${run.id}` })
  }
  return { id: run.id, invocation: imported.id, replaced: imported.replaced, steps: session.steps.length, workspace, summary: Boolean(upload.summary) }
})
