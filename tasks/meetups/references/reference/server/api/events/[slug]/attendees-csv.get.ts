import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { findEvent } from "../../../data/events"

function cell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text
}

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ status: 401, message: "Sign in first" })
  const found = findEvent(getRouterParam(event, "slug") ?? "")
  if (!found) throw createError({ status: 404, message: "Event not found" })
  if (found.organizerId !== user.id) throw createError({ status: 403, message: "Only the organizer of this event can download its attendees" })
  const rows = [["Name", "Email", "Seats", "RSVP time"], ...found.attendees.map(attendee => [attendee.name, attendee.email, attendee.seats, attendee.rsvpAt])]
  return new Response(`${rows.map(row => row.map(cell).join(",")).join("\n")}\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendees-${found.slug}.csv"` },
  })
})
