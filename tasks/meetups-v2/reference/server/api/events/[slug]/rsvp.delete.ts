import { and, eq } from "drizzle-orm"
import { defineEventHandler, getRouterParam } from "nuxt/server"
import { findEventBySlug, seatsTaken } from "#server/utils/events"
import { requireUser } from "#server/utils/session"
import { db, schema } from "vite-hub/database/drizzle"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  await db.delete(schema.rsvps).where(and(eq(schema.rsvps.eventId, found.id), eq(schema.rsvps.userId, user.id)))
  return { going: false, seatsLeft: Math.max(found.capacity - await seatsTaken(found.id), 0) }
})
