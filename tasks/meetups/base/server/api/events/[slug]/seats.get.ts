import { defineEventHandler, getRouterParam } from "nuxt/server"
import { findEventBySlug, seatsLeft } from "#server/utils/events"

export default defineEventHandler(async (event) => {
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  event.res.headers.set("cache-control", "no-store")
  return { seatsLeft: await seatsLeft(found.id) }
})
