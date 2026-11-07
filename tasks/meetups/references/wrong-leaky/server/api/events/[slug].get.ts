import { createError, defineEventHandler, getRequestHeader, getRouterParam } from "nuxt/server"
import { findEvent, seatsLeft } from "../../data/events"

export default defineEventHandler(async (event) => {
  const found = findEvent(getRouterParam(event, "slug") ?? "")
  if (!found) throw createError({ status: 404, message: "Event not found" })
  return {
    ...found,
    seatsLeft: seatsLeft(found),
    price: await formatPrice(found.priceCents, currencyFor(getRequestHeader(event, "accept-language"))),
  }
})
