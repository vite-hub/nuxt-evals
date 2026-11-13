import { defineHandler, getRouterParam, HTTPError } from "h3"
import { getProject } from "../../utils/store"

export default defineHandler((event) => {
  const project = getProject(getRouterParam(event, "slug") ?? "")
  if (!project) throw new HTTPError({ status: 404, message: "Project not found" })
  return project
})
