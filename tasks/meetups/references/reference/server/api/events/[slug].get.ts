import { createError, defineEventHandler, getQuery, getRequestHeader, getRouterParam } from "nuxt/server"
import { findEvent, seatsLeft } from "../../data/events"

export default defineEventHandler(async (event) => {
  const found = findEvent(getRouterParam(event, "slug") ?? "")
  if (!found) throw createError({ status: 404, message: "Event not found" })
  return {
    slug: found.slug,
    title: found.title,
    city: found.city,
    startsAt: found.startsAt,
    venue: found.venue,
    description: found.description,
    seatsLeft: seatsLeft(found),
    price: await formatPrice(found.priceCents, currencyFor(getRequestHeader(event, "accept-language"), getQuery(event).currency)),
  }
})
