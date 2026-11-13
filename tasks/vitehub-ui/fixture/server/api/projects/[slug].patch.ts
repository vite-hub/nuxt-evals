import { defineHandler, getRouterParam, HTTPError, readValidatedBody } from "h3"
import { z } from "zod"
import { branches, updateProject } from "../../utils/store"

const body = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  visibility: z.enum(["private", "public"]).optional(),
  defaultBranch: z.enum(branches).optional(),
})

export default defineHandler(async (event) => {
  const patch = await readValidatedBody(event, body)
  const project = updateProject(getRouterParam(event, "slug") ?? "", patch)
  if (!project) throw new HTTPError({ status: 404, message: "Project not found" })
  return project
})
