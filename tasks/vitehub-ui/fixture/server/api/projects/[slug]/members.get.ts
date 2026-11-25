import { defineHandler, getRouterParam, HTTPError } from "h3"
import { listMembers } from "../../../utils/store"

export default defineHandler((event) => {
  const members = listMembers(getRouterParam(event, "slug") ?? "")
  if (!members) throw new HTTPError({ status: 404, message: "Project not found" })
  return members
})
