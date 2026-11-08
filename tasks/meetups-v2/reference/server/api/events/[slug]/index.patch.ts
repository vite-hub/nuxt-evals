import { and, count, eq, gte, sql } from "drizzle-orm"
import { createError, defineEventHandler, getRouterParam, readValidatedBody } from "nuxt/server"
import { eventInputSchema } from "#shared/schemas/event"
import { zonedLocalToInstant } from "#shared/utils/time"
import { findOwnedEvent } from "#server/utils/events"
import { requireUser } from "#server/utils/session"
import { db, schema } from "vite-hub/database/drizzle"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const found = await findOwnedEvent(getRouterParam(event, "slug")!, user.id)
  const { startsAtLocal, ...input } = await readValidatedBody(event, eventInputSchema.parse)
  const { events, rsvps } = schema

  // One statement: the seat count and the update can't interleave with an RSVP.
  const taken = db.select({ value: count() }).from(rsvps).where(eq(rsvps.eventId, found.id))
  const updated = await db.update(events)
    .set({ ...input, startsAt: zonedLocalToInstant(startsAtLocal, input.timeZone) })
    .where(and(eq(events.id, found.id), gte(sql`${input.capacity}`, taken)))
    .returning({ slug: events.slug })

  if (!updated.length) {
    throw createError({ status: 422, statusText: "More people are already going than that. Pick a higher number of seats." })
  }
  return updated[0]!
})
