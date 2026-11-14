import { and, eq, sql } from "drizzle-orm"
import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { db, schema } from "vite-hub/database/drizzle"
import { runQueue } from "vite-hub/queue"
import { requireRateLimit } from "vite-hub/rate-limit"
import { findEventBySlug, seatsLeft } from "#server/utils/events"
import { requireUser } from "#server/utils/session"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await requireRateLimit(event.req, "rsvp", { limit: 20, window: "1m", key: user.id })
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  const { events, rsvps } = schema

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
    const rsvpId = inserted[0]!.id
    const [error] = await runQueue("rsvp-confirmation", { rsvpId }, { idempotencyKey: `rsvp-confirmation:${rsvpId}` })
    if (error) console.error(`Confirmation for RSVP ${rsvpId} not queued`, error)
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
