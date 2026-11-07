import { createError, defineHandler, getQuery, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { useDatabase } from "vite-hub/database/drizzle"
import { useWorkspaceFiles } from "vite-hub/workspace/files"

async function read(workspace: ReturnType<typeof useWorkspaceFiles>, revision: string | undefined, path: string): Promise<string | null> {
  if (!revision) return null
  const view = await workspace.history.open(revision)
  return await view.readFile(path).catch(() => null)
}

/** One file of the run, and the same file in the starting app, for the diff. */
export default defineHandler(async (event): Promise<{ path: string, before: string | null, after: string | null }> => {
  const id = getRouterParam(event, "id")
  const path = getQuery(event).path
  if (!id || !/^[\w.-]+$/.test(id) || typeof path !== "string" || !path || path.includes("..")) throw createError({ status: 400, message: "Name a run and a file." })
  const { db, schema } = useDatabase("default")
  const [row] = await db.select({ project: schema.runs.project }).from(schema.runs).where(eq(schema.runs.id, id))
  if (!row) throw createError({ status: 404, message: "Run not found." })
  const workspace = useWorkspaceFiles(row.project as "meetups")
  const [head, main] = await Promise.all([workspace.history.head({ ref: id }), workspace.history.head()])
  const [after, before] = await Promise.all([read(workspace, head?.id, path), read(workspace, main?.id, path)])
  if (after === null && before === null) throw createError({ status: 404, message: "No such file in this run." })
  return { path, before, after }
})
