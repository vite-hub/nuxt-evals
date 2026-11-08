import { defineEventHandler } from "h3"
import { and, eq, sql } from "drizzle-orm"
import { createError, getRouterParam } from "nuxt/server"
import { requireRateLimit } from "vite-hub/rate-limit"
import { findEventBySlug, seatsTaken } from "#server/utils/events"
import { sendRsvpConfirmation } from "#server/utils/mail"
import { requireUser } from "#server/utils/session"
import { db, schema } from "vite-hub/database/drizzle"

// h3's handler, not nuxt/server's: its event carries waitUntil() and the client address that Rate Limit reads.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await requireRateLimit(event, "rsvp", { limit: 20, window: "1m", key: user.id })
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  if (found.startsAt.getTime() < Date.now()) throw createError({ status: 409, statusText: "This event has already started." })
  const { rsvps } = schema

  // Insert only while a seat is free, in one statement, so two last-second clicks can't both get the last seat.
  // The unique index on (event, user) turns a double click into a no-op instead of a second seat.
  const inserted = await db.all<{ id: number }>(sql`
    insert into ${rsvps} (event_id, user_id, created_at)
    select ${found.id}, ${user.id}, ${Date.now()}
    where (select count(*) from ${rsvps} where event_id = ${found.id}) < ${found.capacity}
    on conflict do nothing
    returning id
  `)

  if (!inserted.length) {
    const [already] = await db.select({ id: rsvps.id }).from(rsvps)
      .where(and(eq(rsvps.eventId, found.id), eq(rsvps.userId, user.id))).limit(1)
    if (!already) throw createError({ status: 409, statusText: "Sorry, the last seat just went." })
  }
  else {
    // Mail is slow. Answer now; the runtime keeps the request alive until the mail is sent.
    event.waitUntil(sendRsvpConfirmation({ to: user.email, name: user.name, event: found }))
  }

  return { going: true, seatsLeft: Math.max(found.capacity - await seatsTaken(found.id), 0) }
})
