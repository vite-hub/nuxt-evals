import { createError, defineHandler, getRouterParam } from "h3"
import { blob } from "vite-hub/blob"
import type { RunFile } from "../../../shared/report"

export default defineHandler(async (event): Promise<{ files: RunFile[], diff: string }> => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ status: 400, message: "Missing workspace id." })
  const [error, file] = await blob.get(`runs/${id}.json`)
  if (error) throw error
  if (!file) throw createError({ status: 404, message: "Workspace not found." })
  const { files, diff } = JSON.parse(await file.text()) as { files: RunFile[], diff: string }
  return { files, diff }
})
