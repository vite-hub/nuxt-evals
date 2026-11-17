import { defineHandler } from "h3"
import { createDatabaseAgentInvocationStore } from "vite-hub/agent/invocations/database"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import content from "../content"
import { requireIngestToken } from "../utils/ingest"

/**
 * `evals reset --yes` starts the site over: it deletes every run row, every imported session, the raw session files
 * and the summaries. Workspace history keeps its revisions (it has no pruning); new runs commit to new refs.
 */
export default defineHandler(async (event) => {
  await requireIngestToken(event)
  const { db, schema } = useDatabase("default")
  const ids = (await db.select({ id: schema.runs.id }).from(schema.runs)).map(row => row.id)

  const summaries = content.collection("runs")
  const listed = await summaries.list({ limit: 500 }).then(page => page.items.map(item => item.id), () => [])
  const documents = [...new Set([...ids, ...listed])]
  for (const id of documents) await summaries.remove(id, { message: `Reset: remove ${id}` }).catch(() => undefined)
  if (documents.length) await content.publish({ collection: "runs", ids: documents, message: "Reset" }).catch(() => undefined)

  const store = createDatabaseAgentInvocationStore()
  const sessions = await store.prune?.({ updatedBefore: new Date(Date.now() + 60_000).toISOString() })

  let files = 0
  for (let cursor: string | undefined, done = false; !done;) {
    const [error, page] = await blob.list({ prefix: "runs/", ...(cursor ? { cursor } : {}) })
    if (error) throw error
    const paths = page.blobs.map(item => item.pathname)
    if (paths.length) {
      const [deleteError] = await blob.delete(paths)
      if (deleteError) throw deleteError
    }
    files += paths.length
    cursor = page.cursor
    done = !page.hasMore || !cursor
  }

  await db.delete(schema.runs)
  return { runs: ids.length, summaries: documents.length, sessions, files }
})
