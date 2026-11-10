import { eq } from "drizzle-orm"
import { defineEventHandler, getRouterParam } from "nuxt/server"
import { db } from "vite-hub/database/drizzle"
import { users } from "#server/databases/config"
import { findEventBySlug, isGoing, seatsLeft } from "#server/utils/events"
import { getSessionUser } from "#server/utils/session"

export default defineEventHandler(async (event) => {
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  const user = await getSessionUser(event)

  const [[organizer], left, going] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, found.organizerId)).limit(1),
    seatsLeft(found.id),
    user ? isGoing(found.id, user.id) : false,
  ])

  return {
    slug: found.slug,
    title: found.title,
    description: found.description,
    city: found.city,
    venue: found.venue,
    startsAt: found.startsAt,
    timeZone: found.timeZone,
    capacity: found.capacity,
    priceCents: found.priceCents,
    coverPath: found.coverPath,
    // The foreign key guarantees the organizer row.
    organizerName: organizer!.name,
    seatsLeft: left,
    // Decided here, at request time, so the server and the browser render the same button.
    started: found.startsAt.getTime() <= Date.now(),
    going,
    isOrganizer: user?.id === found.organizerId,
  }
})
