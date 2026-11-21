import { createError, defineHandler, getRouterParam, readBody } from "h3"
import type { BaseUpload } from "../../../../shared/report"
import { requireIngestToken } from "../../../utils/ingest"
import { fileMap, fixtureHash, projectWorkspaces, writableProjectWorkspace } from "../../../utils/project-workspace"

/**
 * `evals base <project>` posts the starting app, its prompt and its probes. They become the head of Workspace `main`,
 * which the project page shows and the next runs start from. Runs keep the `main` revision they started from.
 */
export default defineHandler(async (event) => {
  await requireIngestToken(event)
  const project = getRouterParam(event, "project")
  if (!project || !projectWorkspaces.has(project)) throw createError({ status: 404, message: "Unknown project." })
  const upload = await readBody<BaseUpload>(event)
  if (!upload?.files?.length || typeof upload.prompt !== "string" || !Array.isArray(upload.probes)) {
    throw createError({ status: 400, message: "Send the files, the prompt and the probes." })
  }
  const workspace = writableProjectWorkspace(project)
  const files = fileMap(upload.files)
  const metadata = {
    fixture: await fixtureHash(files),
    title: upload.title,
    prompt: upload.prompt,
    probes: upload.probes,
    ...(upload.rubric ? { rubric: upload.rubric } : {}),
    ...(upload.reference ? { reference: upload.reference } : {}),
  }
  const head = await workspace.history.head()
  if (head && JSON.stringify(head.metadata ?? {}) === JSON.stringify(metadata)) return { revision: head.id, changed: false }
  const revision = await workspace.history.commit({ ifHead: head?.id ?? null, files, message: "Starting app", metadata })
  return { revision: revision.id, changed: true }
})
