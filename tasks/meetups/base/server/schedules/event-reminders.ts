import { and, eq, gt, isNull, lte } from "drizzle-orm"
import { db, schema } from "vite-hub/database/drizzle"
import { runQueue } from "vite-hub/queue"
import { defineSchedule } from "vite-hub/schedule"

const DAY = 24 * 60 * 60 * 1000

export default defineSchedule({
  cron: "*/15 * * * *",
  manual: true,
  async handler({ scheduledAt }) {
    const { rsvps, events } = schema
    const now = scheduledAt.getTime()
    const due = await db.select({ id: rsvps.id }).from(rsvps)
      .innerJoin(events, eq(events.id, rsvps.eventId))
      .where(and(
        isNull(rsvps.reminderSentAt),
        gt(events.startsAt, new Date(now)),
        lte(events.startsAt, new Date(now + DAY)),
      ))
    for (const { id } of due) {
      const [error] = await runQueue("event-reminder", { rsvpId: id }, { idempotencyKey: `event-reminder:${id}` })
      if (error) console.error(`Reminder for RSVP ${id} not queued`, error)
    }
    return { queued: due.length }
  },
})
