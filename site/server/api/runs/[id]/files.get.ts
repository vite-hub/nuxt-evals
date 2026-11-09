import { createError, defineHandler, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { useDatabase } from "vite-hub/database/drizzle"
import { projectWorkspace, revisionFiles } from "../../../utils/project-workspace"

/** Every file of the run's working copy, for the in-browser preview. */
export default defineHandler(async (event): Promise<{ files: Record<string, string> }> => {
  const id = getRouterParam(event, "id")
  if (!id || !/^[\w.-]+$/.test(id)) throw createError({ status: 400, message: "Missing run id." })
  const { db, schema } = useDatabase("default")
  const [row] = await db.select({ project: schema.runs.project }).from(schema.runs).where(eq(schema.runs.id, id))
  if (!row) throw createError({ status: 404, message: "Run not found." })
  const workspace = projectWorkspace(row.project)
  const head = await workspace.history.head({ ref: id })
  if (!head) throw createError({ status: 404, message: "This run has no files in the Workspace." })
  return { files: await revisionFiles(workspace, head.id) }
})
