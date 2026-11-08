import { count } from "drizzle-orm"
import { defineTask } from "nitro/task"
import { auth } from "vite-hub/auth/server"
import { zonedLocalToInstant } from "#shared/utils/time"
import { slugify } from "#server/utils/events"
import { db, schema } from "vite-hub/database/drizzle"

const people = [
  { name: "Ada Lovelace", email: "ada@meetups.test" },
  { name: "Grace Hopper", email: "grace@meetups.test" },
  { name: "Linus Torvalds", email: "linus@meetups.test" },
]
const PASSWORD = "meetups-demo-password"

const cities = [
  { city: "Madrid", timeZone: "Europe/Madrid", venues: ["Impact Hub Picasso", "Campus Madrid"] },
  { city: "London", timeZone: "Europe/London", venues: ["Google for Startups Campus", "Barbican Centre"] },
  { city: "Berlin", timeZone: "Europe/Berlin", venues: ["Factory Berlin", "betahaus"] },
  { city: "New York", timeZone: "America/New_York", venues: ["Civic Hall", "WeWork Fulton"] },
  { city: "San Francisco", timeZone: "America/Los_Angeles", venues: ["GitHub HQ", "Cloudflare SF"] },
  { city: "Tokyo", timeZone: "Asia/Tokyo", venues: ["Shibuya Hikarie", "Mori Tower"] },
  { city: "São Paulo", timeZone: "America/Sao_Paulo", venues: ["Cubo Itaú", "Google Campus SP"] },
  { city: "Bangalore", timeZone: "Asia/Kolkata", venues: ["NUMA Bengaluru", "91springboard"] },
]
const topics = ["Vue", "Nuxt", "Vite", "TypeScript", "Rust", "Postgres", "AI agents", "Accessibility", "CSS", "Node.js"]
const formats = ["Meetup", "Workshop", "Lightning talks", "Hack night", "Study group"]

/** A small seeded generator, so every seed run makes the same events. */
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

export default defineTask({
  meta: { name: "db:seed", description: "Create demo users, events and RSVPs" },
  async run() {
    const [existing] = await db.select({ value: count() }).from(schema.events)
    if (existing && existing.value > 0) return { result: "Already seeded" }

    const userIds: string[] = []
    for (const person of people) {
      const { user } = await auth.api.signUpEmail({ body: { ...person, password: PASSWORD } })
      userIds.push(user.id)
    }

    const next = random(42)
    const pick = <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]!
    const today = new Date()
    const rows = Array.from({ length: 240 }, (_, i) => {
      const place = pick(cities)
      const topic = pick(topics)
      const day = new Date(today.getTime() + (1 + Math.floor(i / 3)) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const startsAtLocal = `${day}T${pick(["18:00", "18:30", "19:00", "10:00"])}`
      const title = `${topic} ${pick(formats)} ${place.city}`
      return {
        slug: slugify(title),
        title,
        description: `An evening about ${topic} with talks from the community, time to meet people, and snacks. Everyone is welcome, from first-timers to maintainers.`,
        city: place.city,
        venue: pick(place.venues),
        startsAt: zonedLocalToInstant(startsAtLocal, place.timeZone),
        timeZone: place.timeZone,
        capacity: pick([2, 20, 40, 80, 150]),
        priceCents: pick([0, 0, 0, 500, 1500, 2500]),
        // Ada and Grace organize; Linus only attends.
        organizerId: userIds[i % 2]!,
      }
    })
    const created = await db.insert(schema.events).values(rows).returning({ id: schema.events.id, capacity: schema.events.capacity })

    const rsvps = created.flatMap(event => [userIds[2]!, userIds[(event.id + 1) % 2]!]
      .slice(0, event.capacity)
      .filter(() => next() < 0.4)
      .map(userId => ({ eventId: event.id, userId })))
    if (rsvps.length) await db.insert(schema.rsvps).values(rsvps).onConflictDoNothing()

    return { result: `Seeded ${people.length} users, ${created.length} events and ${rsvps.length} RSVPs. Password: ${PASSWORD}` }
  },
})
