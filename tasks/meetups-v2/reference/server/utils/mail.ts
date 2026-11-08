import { useRuntimeConfig } from "nuxt/server"
import { email } from "vite-hub/email/server"

interface RsvpMail {
  /** The site's origin, from the request, for the link back to the event. */
  origin: string
  to: string
  name: string
  event: { title: string, slug: string, venue: string, city: string, startsAt: Date, timeZone: string }
}

/** Runs after the response. The seat is booked either way, so a failure is logged for the operator, not thrown. */
export async function sendRsvpConfirmation({ origin, to, name, event }: RsvpMail) {
  const { mail } = useRuntimeConfig()
  // The guest reads the mail anywhere, so give the time where the event happens, and name the zone.
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: event.timeZone })
    .format(event.startsAt)

  const [error] = await email.send({
    from: mail.from,
    to,
    subject: `You're going to ${event.title}`,
    text: [
      `Hi ${name},`,
      "",
      `Your seat for ${event.title} is booked.`,
      `When: ${when} (${event.timeZone.replaceAll("_", " ")} time)`,
      `Where: ${event.venue}, ${event.city}`,
      "",
      `${origin}/events/${event.slug}`,
    ].join("\n"),
  })
  if (error) console.error(`RSVP mail to ${to} failed: ${error.code}`, error)
}
