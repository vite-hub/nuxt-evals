import { eq } from "drizzle-orm"
import { defineEventHandler, getRouterParam } from "nuxt/server"
import { users } from "#server/databases/config"
import { findEventBySlug, isGoing, seatsTaken } from "#server/utils/events"
import { getSessionUser } from "#server/utils/session"
import { db } from "vite-hub/database/drizzle"

export default defineEventHandler(async (event) => {
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  const user = await getSessionUser(event)

  const [[organizer], taken, going] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, found.organizerId)).limit(1),
    seatsTaken(found.id),
    user ? isGoing(found.id, user.id) : false,
  ])

  return {
    id: found.id,
    slug: found.slug,
    title: found.title,
    description: found.description,
    city: found.city,
    venue: found.venue,
    startsAt: found.startsAt,
    timeZone: found.timeZone,
    capacity: found.capacity,
    priceCents: found.priceCents,
    organizerName: organizer?.name ?? "Unknown",
    seatsLeft: Math.max(found.capacity - taken, 0),
    going,
    isOrganizer: user?.id === found.organizerId,
  }
})
