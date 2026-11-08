import { useRuntimeConfig } from "nuxt/server"
import { email } from "vite-hub/email/server"

interface RsvpMail {
  /** The site's origin, from the request, for the link back to the event. */
  origin: string
  to: string
  name: string
  event: { title: string, slug: string, venue: string, city: string, startsAt: Date, timeZone: string }
}

export async function sendRsvpConfirmation({ origin, to, name, event }: RsvpMail) {
  const { mail } = useRuntimeConfig()
  // The guest reads the mail anywhere, so give the time where the event happens, with its zone.
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: event.timeZone, timeZoneName: "short" })
    .format(event.startsAt)
  try {
    await email.send({
      from: mail.from,
      to,
      subject: `You're going to ${event.title}`,
      text: [
        `Hi ${name},`,
        "",
        `Your seat for ${event.title} is booked.`,
        `When: ${when}`,
        `Where: ${event.venue}, ${event.city}`,
        "",
        `${origin}/events/${event.slug}`,
      ].join("\n"),
    })
  }
  catch (error) {
    // The seat is booked either way. Log for the operator; the guest sees the booking on the page.
    console.error(`RSVP mail to ${to} failed`, error)
  }
}
