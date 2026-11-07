import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { findEvent, seatsLeft } from "../../../data/events"

export default defineEventHandler((event) => {
  const found = findEvent(getRouterParam(event, "slug") ?? "")
  if (!found) throw createError({ status: 404, message: "Event not found" })
  return { seatsLeft: seatsLeft(found) }
})
