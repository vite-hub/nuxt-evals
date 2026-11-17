import { createError, defineHandler, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { createDatabaseAgentInvocationStore } from "vite-hub/agent/invocations/database"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import content from "../../../content"
import { requireIngestToken } from "../../../utils/ingest"

/**
 * `evals unpush <id>` removes one run: its row, its imported session, its raw session file and its summary. The run's
 * Workspace ref keeps its revisions (Workspaces have no pruning).
 */
export default defineHandler(async (event) => {
  await requireIngestToken(event)
  const id = getRouterParam(event, "id") ?? ""
  const { db, schema } = useDatabase("default")
  const [row] = await db.select({ id: schema.runs.id, invocation: schema.runs.invocation }).from(schema.runs).where(eq(schema.runs.id, id))
  if (!row) throw createError({ status: 404, message: `No run ${id}.` })

  await content.collection("runs").remove(id, { message: `Remove ${id}` }).catch(() => undefined)
  await content.publish({ collection: "runs", ids: [id], message: `Remove ${id}` }).catch(() => undefined)
  if (row.invocation) await createDatabaseAgentInvocationStore().delete?.(row.invocation)
  const [error] = await blob.delete([`runs/${id}/session.jsonl`])
  if (error) throw error
  await db.delete(schema.runs).where(eq(schema.runs.id, id))
  return { id, removed: true }
})
