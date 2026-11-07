import { createError, defineHandler, readBody } from "h3"
import { importAgentSession, readAgentSession } from "@vite-hub/agent/sessions"
import { createDatabaseAgentInvocationStore } from "vite-hub/agent/invocations/database"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database/drizzle"
import { useWorkspaceFiles } from "vite-hub/workspace/files"
import { consoleAgentName, type RunFile, type RunRecord, type RunUpload } from "../../shared/report"
import { harnessLabel, modelLabel, projectLabel } from "../../shared/labels"
import { content } from "../content"
import { requireIngestToken } from "../utils/ingest"

/** Projects that have a Workspace in `server/workspaces/`. */
const projectWorkspaces = new Set(["meetups"])
const hiddenPath = /(?:^|\/)(?:\.git|\.vitehub|\.env(?:\..*)?)(?:\/|$)/

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("")
}

function fileMap(files: RunFile[]): Record<string, string> {
  return Object.fromEntries(files.filter(file => !hiddenPath.test(file.path)).map(file => [file.path, file.content]))
}

/** `main` holds the project's starting files; the run's working copy goes on a ref named after the run. */
async function commitWorkspace(run: RunRecord, upload: RunUpload) {
  if (!projectWorkspaces.has(run.project) || !upload.base?.length) return
  const workspace = useWorkspaceFiles(run.project, { mode: "write" })
  const base = fileMap(upload.base)
  const fixture = await sha256(JSON.stringify(Object.entries(base).sort(([a], [b]) => a.localeCompare(b))))
  let main = await workspace.history.head()
  if (main?.metadata?.fixture !== fixture) {
    main = await workspace.history.commit({ ifHead: main?.id ?? null, files: base, message: "Starting app", metadata: { fixture } })
  }
  const head = await workspace.history.head({ ref: run.id })
  const revision = await workspace.history.commit({
    ref: run.id,
    ifHead: head?.id ?? null,
    files: fileMap(upload.files),
    message: `${harnessLabel(run.harness)} ${modelLabel(run.model)} ${run.reasoning}, setup ${run.setup} #${run.repeat}`,
    metadata: { run: run.id, harness: run.harness, model: run.model, setup: run.setup, score: run.score },
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
