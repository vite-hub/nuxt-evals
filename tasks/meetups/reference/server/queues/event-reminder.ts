import { defineQueue } from "vite-hub/queue"
import { sendRsvpMail } from "#server/utils/mail"

/** The day-before reminder for one RSVP. server/schedules/event-reminders.ts sends these jobs. */
export default defineQueue<{ rsvpId: number }>(({ payload }) => sendRsvpMail("reminder", payload.rsvpId))
