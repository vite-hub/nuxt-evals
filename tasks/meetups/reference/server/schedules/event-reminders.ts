import { and, eq, gt, isNull, lte } from "drizzle-orm"
import { db, schema } from "vite-hub/database/drizzle"
import { runQueue } from "vite-hub/queue"
import { defineSchedule } from "vite-hub/schedule"

const DAY = 24 * 60 * 60 * 1000

/**
 * Every 15 minutes, one reminder job per RSVP whose event starts within the next day and that has had no reminder.
 * The job marks the RSVP as reminded, so later runs skip it. `vitehub schedule run event-reminders` runs it now.
 */
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
      // The key holds while a job for this RSVP waits or runs, so overlapping runs don't queue it twice.
      const [error] = await runQueue("event-reminder", { rsvpId: id }, { idempotencyKey: `event-reminder:${id}` })
      if (error) console.error(`Reminder for RSVP ${id} not queued`, error)
    }
    return { queued: due.length }
  },
})
