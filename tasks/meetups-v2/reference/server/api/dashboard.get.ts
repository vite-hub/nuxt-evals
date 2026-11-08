import { count, desc, eq } from "drizzle-orm"
import { defineEventHandler } from "nuxt/server"

import { requireUser } from "#server/utils/session"
import { db, schema } from "vite-hub/database/drizzle"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { events, rsvps } = schema
  const rows = await db.select({
    slug: events.slug,
    title: events.title,
    city: events.city,
    startsAt: events.startsAt,
    capacity: events.capacity,
    taken: count(rsvps.id),
  })
    .from(events)
    .leftJoin(rsvps, eq(rsvps.eventId, events.id))
    .where(eq(events.organizerId, user.id))
    .groupBy(events.id)
    .orderBy(desc(events.startsAt))
  return rows
})
