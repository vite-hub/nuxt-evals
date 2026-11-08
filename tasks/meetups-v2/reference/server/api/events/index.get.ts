import { and, asc, count, eq, gte, or, sql } from "drizzle-orm"
import { defineEventHandler, getValidatedQuery } from "nuxt/server"
import { EVENTS_PAGE_SIZE, eventsQuerySchema } from "#shared/schemas/event"
import { db, schema } from "vite-hub/database/drizzle"

/** Escape LIKE wildcards so a search for "100%" matches the text "100%", not everything. */
function containing(text: string) {
  return `%${text.replace(/[\\%_]/g, char => `\\${char}`)}%`
}

export default defineEventHandler(async (event) => {
  const { q, city, page } = await getValidatedQuery(event, eventsQuerySchema.parse)
  const { events, rsvps } = schema

  const where = and(
    gte(events.startsAt, new Date()),
    city ? eq(events.city, city) : undefined,
    q
      ? or(
          sql`${events.title} LIKE ${containing(q)} ESCAPE '\\'`,
          sql`${events.venue} LIKE ${containing(q)} ESCAPE '\\'`,
          sql`${events.city} LIKE ${containing(q)} ESCAPE '\\'`,
        )
      : undefined,
  )

  const taken = db.select({ eventId: rsvps.eventId, taken: count().as("taken") })
    .from(rsvps).groupBy(rsvps.eventId).as("taken")

  const [items, [total]] = await Promise.all([
    db.select({
      slug: events.slug,
      title: events.title,
      city: events.city,
      venue: events.venue,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
      priceCents: events.priceCents,
      capacity: events.capacity,
      taken: sql<number>`coalesce(${taken.taken}, 0)`,
    })
      .from(events)
      .leftJoin(taken, eq(taken.eventId, events.id))
      .where(where)
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(EVENTS_PAGE_SIZE)
      .offset((page - 1) * EVENTS_PAGE_SIZE),
    db.select({ value: count() }).from(events).where(where),
  ])

  return {
    items: items.map(({ capacity, taken, ...item }) => ({ ...item, seatsLeft: Math.max(capacity - taken, 0) })),
    total: total?.value ?? 0,
    page,
    pageSize: EVENTS_PAGE_SIZE,
  }
})
