import { defineEventHandler, getRouterParam } from "nuxt/server"
import { findOwnedEvent, listAttendees } from "#server/utils/events"
import { requireUser } from "#server/utils/session"

function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll("\"", "\"\"")}"`
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const found = await findOwnedEvent(getRouterParam(event, "slug")!, user.id)
  const attendees = await listAttendees(found.id)

  const rows = [
    ["Name", "Email", "RSVP at (UTC)"],
    ...attendees.map(a => [a.name, a.email, a.rsvpAt.toISOString()]),
  ]
  const csv = `${rows.map(row => row.map(csvField).join(",")).join("\r\n")}\r\n`

  event.res.headers.set("content-type", "text/csv; charset=utf-8")
  event.res.headers.set("content-disposition", `attachment; filename="${found.slug}-attendees.csv"`)
  event.res.headers.set("cache-control", "private, no-store")
  return `﻿${csv}`
})
