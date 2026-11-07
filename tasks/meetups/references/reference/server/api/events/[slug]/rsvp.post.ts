import { createError, defineEventHandler, getRouterParam, readValidatedBody } from "nuxt/server"
import { rsvpSchema } from "#shared/rsvp"
import { addAttendee, seatsLeft } from "../../../data/events"

export default defineEventHandler(async (event) => {
  const rsvp = await readValidatedBody(event, rsvpSchema)
  const updated = addAttendee(getRouterParam(event, "slug") ?? "", rsvp)
  if (!updated) throw createError({ status: 404, message: "Event not found" })
  // The mail provider is slow. Answer now and let the send finish after the response.
  event.waitUntil(sendMail({
    to: rsvp.email,
    subject: `You're going to ${updated.title}`,
    text: `Hi ${rsvp.name}, you booked ${rsvp.seats} seat(s) for ${updated.title} on ${updated.startsAt}.`,
  }))
  return { seatsLeft: seatsLeft(updated) }
})
