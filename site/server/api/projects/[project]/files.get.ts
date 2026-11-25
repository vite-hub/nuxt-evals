import { createError, defineHandler, getRouterParam } from "h3"
import { projectWorkspace, projectWorkspaces, revisionFiles } from "../../../utils/project-workspace"

/** Every file of the project's starting app, for the in-browser preview. */
export default defineHandler(async (event): Promise<{ files: Record<string, string> }> => {
  const project = getRouterParam(event, "project")
  if (!project || !projectWorkspaces.has(project)) throw createError({ status: 404, message: "Unknown project." })
  const workspace = projectWorkspace(project)
  const head = await workspace.history.head()
  if (!head) throw createError({ status: 404, message: "This project has no starting app yet." })
  return { files: await revisionFiles(workspace, head.id) }
})
