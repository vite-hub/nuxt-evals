import { and, asc, eq, sql } from "drizzle-orm"
import { createError } from "nuxt/server"
import { db, schema } from "vite-hub/database/drizzle"
import { users } from "#server/databases/config"

export async function findEventBySlug(slug: string) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.slug, slug)).limit(1)
  if (!event) throw createError({ status: 404, statusText: "Event not found" })
  return event
}

/** The event, only when `userId` organizes it. A stranger gets the same 404 as for a missing event. */
export async function findOwnedEvent(slug: string, userId: string) {
  const event = await findEventBySlug(slug)
  if (event.organizerId !== userId) throw createError({ status: 404, statusText: "Event not found" })
  return event
}

/** Seats still free, from the rows as they are now. */
export async function seatsLeft(eventId: number): Promise<number> {
  const { events, rsvps } = schema
  const [row] = await db.select({
    left: sql<number>`max(${events.capacity} - (select count(*) from ${rsvps} where ${rsvps.eventId} = ${eventId}), 0)`,
  }).from(events).where(eq(events.id, eventId))
  return row?.left ?? 0
}

export async function isGoing(eventId: number, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: schema.rsvps.id }).from(schema.rsvps)
    .where(and(eq(schema.rsvps.eventId, eventId), eq(schema.rsvps.userId, userId))).limit(1)
  return Boolean(row)
}

/** "Rust Meetup: Ownership!" becomes "rust-meetup-ownership-k3x9". The suffix keeps two events with one title apart. */
export function slugify(title: string): string {
  const base = title.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "event"
  return `${base}-${crypto.randomUUID().slice(0, 4)}`
}

export async function listAttendees(eventId: number) {
  return db.select({ name: users.name, email: users.email, rsvpAt: schema.rsvps.createdAt })
    .from(schema.rsvps)
    .innerJoin(users, eq(users.id, schema.rsvps.userId))
    .where(eq(schema.rsvps.eventId, eventId))
    .orderBy(asc(schema.rsvps.createdAt))
}
