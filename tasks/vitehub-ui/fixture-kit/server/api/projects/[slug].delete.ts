import { defineHandler, getRouterParam, HTTPError } from "h3"
import { deleteProject } from "../../utils/store"

export default defineHandler((event) => {
  if (!deleteProject(getRouterParam(event, "slug") ?? "")) throw new HTTPError({ status: 404, message: "Project not found" })
  return { ok: true }
})
