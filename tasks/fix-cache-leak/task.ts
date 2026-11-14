import { fail, pass, Visitor } from "../meetups/checks.ts"
import { fixTask } from "../meetups/fix.ts"

/**
 * Corpus KV5. The event route's body sits in a cached function keyed by the slug, and the cached value carries the
 * visitor's `going` and `isOrganizer`. The cities route's cached function is the pattern a hurried author copies.
 */
export default fixTask({
  id: "fix-cache-leak",
  title: "Event page shows another user's data",
  edits: [
    {
      path: "server/api/events/[slug]/index.get.ts",
      content: `import { eq } from "drizzle-orm"
import { defineCachedFunction } from "nitro/cache"
import { defineEventHandler, getRouterParam } from "nuxt/server"
import { db } from "vite-hub/database/drizzle"
import { users } from "#server/databases/config"
import { findEventBySlug, isGoing, seatsLeft } from "#server/utils/events"
import { getSessionUser } from "#server/utils/session"

const eventPage = defineCachedFunction(async (slug: string, userId: string | null) => {
  const found = await findEventBySlug(slug)

  const [[organizer], left, going] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, found.organizerId)).limit(1),
    seatsLeft(found.id),
    userId ? isGoing(found.id, userId) : false,
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
    organizerName: organizer!.name,
    seatsLeft: left,
    started: found.startsAt.getTime() <= Date.now(),
    going,
    isOrganizer: userId === found.organizerId,
  }
}, { name: "event-page", maxAge: 60, getKey: (slug: string) => slug })

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  return eventPage(getRouterParam(event, "slug")!, user?.id ?? null)
})
`,
    },
  ],
  scripted: {
    checks: ["F1", "C2"],
    async run({ origin, log }) {
      const organizer = await new Visitor(origin).signUp("organizer")
      const other = await new Visitor(origin).signUp("other")
      const third = await new Visitor(origin).signUp("third")
      const anonymous = new Visitor(origin)
      const slug = await organizer.createEvent({ capacity: 20 })
      const page = (visitor: Visitor) => visitor.getJson<{ isOrganizer: boolean, going: boolean, seatsLeft: number }>(`/api/events/${slug}`)

      const seen: string[] = []
      const mine = await page(organizer)
      const theirs = await page(other)
      const signedOut = await page(anonymous)
      seen.push(`organizer isOrganizer=${mine.isOrganizer}`, `other isOrganizer=${theirs.isOrganizer} going=${theirs.going}`, `signed out isOrganizer=${signedOut.isOrganizer} going=${signedOut.going}`)
      const before = signedOut.seatsLeft
      const rsvp = await other.send("POST", `/api/events/${slug}/rsvp`)
      const afterOther = await page(other)
      const afterThird = await page(third)
      const afterAnonymous = await page(anonymous)
      seen.push(`other RSVPs (${rsvp.status}), then other going=${afterOther.going}`, `third going=${afterThird.going} isOrganizer=${afterThird.isOrganizer}`)
      log(seen.join("; "))

      const right = mine.isOrganizer && !theirs.isOrganizer && !theirs.going && !signedOut.isOrganizer && !signedOut.going
        && rsvp.status === 200 && afterOther.going && !afterThird.going && !afterThird.isOrganizer
      return {
        F1: (right ? pass : fail)(`${seen.join("; ")}.`),
        C2: (afterAnonymous.seatsLeft === before - 1 ? pass : fail)(`Seats left was ${before} before the RSVP and ${afterAnonymous.seatsLeft} right after.`),
      }
    },
  },
})
