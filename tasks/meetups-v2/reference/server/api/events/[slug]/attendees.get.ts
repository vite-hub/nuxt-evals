import { defineEventHandler, getRouterParam } from "nuxt/server"
import { findOwnedEvent, listAttendees } from "#server/utils/events"
import { requireUser } from "#server/utils/session"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const found = await findOwnedEvent(getRouterParam(event, "slug")!, user.id)
  return {
    event: { slug: found.slug, title: found.title, capacity: found.capacity },
    attendees: await listAttendees(found.id),
  }
})
