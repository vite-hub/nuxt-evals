import { fail, pass, signUpMany, Visitor } from "../meetups/checks.ts"
import { fixTask, remoteDatabase } from "../meetups/fix.ts"

/**
 * Corpus DB1. The RSVP route reads the free seats, awaits, then inserts; the seat count no longer stops at 0. Real in
 * 7 of 15 graded Meetups runs (rubric B6), in Drop (`7093d7c0`) and joxi (`9f1bd85`).
 */
export default fixTask({
  id: "fix-seats-race",
  title: "Seats oversold",
  edits: [
    {
      path: "server/api/events/[slug]/rsvp.post.ts",
      content: `import { and, eq } from "drizzle-orm"
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
  const { rsvps } = schema

  if (found.startsAt.getTime() <= Date.now()) {
    throw createError({ status: 409, statusText: "This event has already started." })
  }

  const [already] = await db.select({ id: rsvps.id }).from(rsvps)
    .where(and(eq(rsvps.eventId, found.id), eq(rsvps.userId, user.id))).limit(1)
  if (already) return { going: true, seatsLeft: await seatsLeft(found.id) }

  if (await seatsLeft(found.id) <= 0) {
    throw createError({ status: 409, statusText: "Sorry, the last seat just went." })
  }

  const [inserted] = await db.insert(rsvps).values({ eventId: found.id, userId: user.id })
    .onConflictDoNothing()
    .returning({ id: rsvps.id })

  if (inserted) {
    const [error] = await runQueue("rsvp-confirmation", { rsvpId: inserted.id }, { idempotencyKey: \`rsvp-confirmation:\${inserted.id}\` })
    if (error) console.error(\`Confirmation for RSVP \${inserted.id} not queued\`, error)
  }

  return { going: true, seatsLeft: await seatsLeft(found.id) }
})
`,
    },
    {
      path: "server/utils/events.ts",
      find: "left: sql<number>`max(${events.capacity} - (select count(*) from ${rsvps} where ${rsvps.eventId} = ${eventId}), 0)`,",
      replace: "left: sql<number>`${events.capacity} - (select count(*) from ${rsvps} where ${rsvps.eventId} = ${eventId})`,",
    },
  ],
  // One process on local SQLite never interleaves two requests' queries; a remote database does.
  serverEnv: remoteDatabase,
  scripted: {
    checks: ["F1", "C2"],
    async run({ origin, log }) {
      const organizer = await new Visitor(origin).signUp("organizer")
      const people = await signUpMany(origin, 30, "guest")
      log(`${people.length} visitors signed up`)
      const rounds: string[] = []
      let right = true
      for (let round = 1; round <= 3; round++) {
        const slug = await organizer.createEvent({ capacity: 12 })
        const replies = await Promise.all(people.map(person => person.send("POST", `/api/events/${slug}/rsvp`)))
        const statuses = Object.entries(replies.reduce<Record<number, number>>((counts, reply) => ({ ...counts, [reply.status]: (counts[reply.status] ?? 0) + 1 }), {})).map(([status, count]) => `${count}×${status}`).join(", ")
        const attendees = (await organizer.getJson<{ attendees: unknown[] }>(`/api/events/${slug}/attendees`)).attendees.length
        const seats = (await organizer.getJson<{ seatsLeft: number }>(`/api/events/${slug}/seats`)).seatsLeft
        rounds.push(`round ${round}: ${attendees} RSVPs, ${seats} seats left (${statuses})`)
        if (attendees !== 12 || seats !== 0) right = false
      }
      log(rounds.join("; "))

      const slug = await organizer.createEvent({ capacity: 12 })
      const [person] = people
      const clicks = await Promise.all([person!, person!, person!].map(visitor => visitor.send("POST", `/api/events/${slug}/rsvp`)))
      const rows = (await organizer.getJson<{ attendees: unknown[] }>(`/api/events/${slug}/attendees`)).attendees.length
      const going = clicks.every(reply => reply.status === 200 && reply.json().going === true)
      return {
        F1: (right ? pass : fail)(`12-seat event, 30 visitors at once. ${rounds.join("; ")}.`),
        C2: (rows === 1 && going ? pass : fail)(`One visitor sent three RSVPs at once: ${rows} RSVP rows, answers ${clicks.map(reply => reply.status).join(", ")}.`),
      }
    },
  },
})
