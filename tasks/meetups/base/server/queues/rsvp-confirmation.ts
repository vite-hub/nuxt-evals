import { defineQueue } from "vite-hub/queue"
import { sendRsvpMail } from "#server/utils/mail"

export default defineQueue<{ rsvpId: number }>(({ payload }) => sendRsvpMail("confirmation", payload.rsvpId))
