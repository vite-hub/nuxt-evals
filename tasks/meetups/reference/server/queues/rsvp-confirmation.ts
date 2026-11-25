import { defineQueue } from "vite-hub/queue"
import { sendRsvpMail } from "#server/utils/mail"

/** The "you're going" email. A provider error throws, and the queue tries again (4 attempts). */
export default defineQueue<{ rsvpId: number }>(({ payload }) => sendRsvpMail("confirmation", payload.rsvpId))
