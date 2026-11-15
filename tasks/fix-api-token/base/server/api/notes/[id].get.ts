import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { notesOf, requireUser } from "../../utils/store"

export default defineEventHandler((event) => {
  const note = notesOf(requireUser(event).id).find(candidate => candidate.id === getRouterParam(event, "id"))
  if (!note) throw createError({ status: 404, statusText: "No such note" })
  return note
})
