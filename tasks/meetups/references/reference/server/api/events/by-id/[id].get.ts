import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { listEvents } from "../../../data/events"

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, "id"))
  const found = listEvents().find(item => item.id === id)
  if (!found) throw createError({ status: 404, message: "Event not found" })
  return { slug: found.slug }
})
