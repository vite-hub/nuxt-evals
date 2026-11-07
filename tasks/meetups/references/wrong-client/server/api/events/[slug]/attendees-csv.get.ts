import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { findEvent } from "../../../data/events"

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  // Wrong: any organizer may download any event's attendees.
  if (user?.role !== "organizer") throw createError({ status: 403, message: "Organizers only" })
  const found = findEvent(getRouterParam(event, "slug") ?? "")
  if (!found) throw createError({ status: 404, message: "Event not found" })
  const csv = ["Name,Email,Seats,RSVP time", ...found.attendees.map(a => [a.name, a.email, a.seats, a.rsvpAt].join(","))].join("\n")
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendees-${found.slug}.csv"` } })
})
