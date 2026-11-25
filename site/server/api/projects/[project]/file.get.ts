import { createError, defineHandler, getQuery, getRouterParam } from "h3"
import { projectWorkspace, projectWorkspaces } from "../../../utils/project-workspace"

/** One file of the project's starting app. */
export default defineHandler(async (event): Promise<{ path: string, content: string }> => {
  const project = getRouterParam(event, "project")
  const path = getQuery(event).path
  if (!project || !projectWorkspaces.has(project)) throw createError({ status: 404, message: "Unknown project." })
  if (typeof path !== "string" || !path || path.includes("..")) throw createError({ status: 400, message: "Name a file." })
  const workspace = projectWorkspace(project)
  const head = await workspace.history.head()
  if (!head) throw createError({ status: 404, message: "This project has no starting app yet." })
  const content = await (await workspace.history.open(head.id)).readFile(path).catch(() => null)
  if (content === null) throw createError({ status: 404, message: "No such file in the starting app." })
  return { path, content }
})
