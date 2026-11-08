import { defineEventHandler, getRouterParam } from "nuxt/server"
import { findEventBySlug, seatsTaken } from "#server/utils/events"

/** Polled by open event pages. Small on purpose: one count, no personal data. */
export default defineEventHandler(async (event) => {
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  event.res.headers.set("cache-control", "no-store")
  return { seatsLeft: Math.max(found.capacity - await seatsTaken(found.id), 0) }
})
