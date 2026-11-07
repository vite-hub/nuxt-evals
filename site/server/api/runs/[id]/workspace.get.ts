import { createError, defineHandler, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { useDatabase } from "vite-hub/database/drizzle"
import { useWorkspaceFiles } from "vite-hub/workspace/files"
import type { WorkspaceView } from "../../../../shared/report"

/** Every file path and digest of one revision. */
async function digests(workspace: ReturnType<typeof useWorkspaceFiles>, revision: string): Promise<Map<string, string>> {
  const view = await workspace.history.open(revision)
  const entries = await view.list("", { recursive: true })
  return new Map(entries.filter(entry => entry.type === "file").map(entry => [entry.path.replace(/^\/+/, ""), entry.digest ?? `${entry.size}`]))
}

/** The run's working copy (Workspace ref = run id) and what changed since the starting app (`main`). */
export default defineHandler(async (event): Promise<WorkspaceView> => {
  const id = getRouterParam(event, "id")
  if (!id || !/^[\w.-]+$/.test(id)) throw createError({ status: 400, message: "Missing run id." })
  const { db, schema } = useDatabase("default")
  const [row] = await db.select({ project: schema.runs.project }).from(schema.runs).where(eq(schema.runs.id, id))
  if (!row) throw createError({ status: 404, message: "Run not found." })
  const workspace = useWorkspaceFiles(row.project as "meetups")
  const head = await workspace.history.head({ ref: id })
  if (!head) throw createError({ status: 404, message: "This run has no files in the Workspace." })
  const main = await workspace.history.head()
  const after = await digests(workspace, head.id)
  const before = main ? await digests(workspace, main.id) : new Map<string, string>()
  const changes: WorkspaceView["changes"] = []
  for (const [path, digest] of after) {
    if (!before.has(path)) changes.push({ path, status: "added" })
    else if (before.get(path) !== digest) changes.push({ path, status: "modified" })
  }
  for (const path of before.keys()) if (!after.has(path)) changes.push({ path, status: "deleted" })
  return { ref: id, revision: head.id, base: main?.id, paths: [...after.keys()].sort(), changes: changes.sort((a, b) => a.path.localeCompare(b.path)) }
})
