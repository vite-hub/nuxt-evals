import { and, eq, sql } from "drizzle-orm"
import { defineEventHandler } from "h3"
import { createError, getRequestURL, getRouterParam, useRuntimeConfig } from "nuxt/server"
import { db, schema } from "vite-hub/database/drizzle"
import { requireRateLimit } from "vite-hub/rate-limit"
import { findEventBySlug, seatsLeft } from "#server/utils/events"
import { sendRsvpConfirmation } from "#server/utils/mail"
import { requireUser } from "#server/utils/session"

// h3's handler, not nuxt/server's: its event carries waitUntil(), which nuxt/server's RequestEvent type lacks.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await requireRateLimit(event.req, "rsvp", { limit: 20, window: "1m", key: user.id })
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  const { events, rsvps } = schema

  // One statement decides: the event hasn't started and a seat is free, read from the rows as they are now,
  // so neither a last-second RSVP nor an organizer lowering the seats can push it over capacity.
  // The unique index on (event, user) turns a double click into a no-op instead of a second seat.
  const inserted = await db.all<{ id: number }>(sql`
    insert into ${rsvps} (event_id, user_id, created_at)
    select ${found.id}, ${user.id}, ${Date.now()}
    from ${events}
    where ${events.id} = ${found.id}
      and ${events.startsAt} > ${Date.now()}
      and (select count(*) from ${rsvps} where ${rsvps.eventId} = ${found.id}) < ${events.capacity}
    on conflict do nothing
    returning id
  `)

  if (inserted.length) {
    // Mail is slow. Answer now; the runtime keeps the process alive until it is sent. A missing mail
    // configuration throws (the others are returned and logged in sendRsvpConfirmation); the booking stands.
    event.waitUntil(sendRsvpConfirmation({ origin: useRuntimeConfig().public.siteUrl || getRequestURL(event).origin, to: user.email, name: user.name, event: found })
      .catch(error => console.error("RSVP mail not sent", error)))
  }
  else {
    const [already] = await db.select({ id: rsvps.id }).from(rsvps)
      .where(and(eq(rsvps.eventId, found.id), eq(rsvps.userId, user.id))).limit(1)
    if (!already) {
      const started = found.startsAt.getTime() <= Date.now()
      throw createError({ status: 409, statusText: started ? "This event has already started." : "Sorry, the last seat just went." })
    }
  }

  return { going: true, seatsLeft: await seatsLeft(found.id) }
})
