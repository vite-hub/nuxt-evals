import { createError, defineHandler, getQuery, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { useDatabase } from "vite-hub/database"
import { projectWorkspace, runBase } from "../../../utils/project-workspace"

async function read(workspace: ReturnType<typeof projectWorkspace>, revision: string | undefined, path: string): Promise<string | null> {
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
  const workspace = projectWorkspace(row.project)
  const head = await workspace.history.head({ ref: id })
  const main = head ? await runBase(workspace, head) : undefined
  const [after, before] = await Promise.all([read(workspace, head?.id, path), read(workspace, main?.id, path)])
  if (after === null && before === null) throw createError({ status: 404, message: "No such file in this run." })
  return { path, before, after }
})
