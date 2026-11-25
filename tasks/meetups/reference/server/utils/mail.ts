import { and, eq, gt, isNull } from "drizzle-orm"
import { useRuntimeConfig } from "nuxt/server"
import renderConfirmation from "#vitehub/emails/rsvp-confirmation"
import renderReminder from "#vitehub/emails/event-reminder"
import renderReset from "#vitehub/emails/reset-password"
import { db, schema } from "vite-hub/database/drizzle"
import { email } from "vite-hub/email/server"
import { renderEmailMarkdown } from "vite-hub/email/markdown"
import { users } from "#server/databases/config"

const { rsvps, events } = schema

const kinds = {
  confirmation: { sent: rsvps.confirmationSentAt, mark: (at: Date | null) => ({ confirmationSentAt: at }), render: renderConfirmation, subject: (title: string) => `You're going to ${title}` },
  reminder: { sent: rsvps.reminderSentAt, mark: (at: Date | null) => ({ reminderSentAt: at }), render: renderReminder, subject: (title: string) => `Tomorrow: ${title}` },
}
export type RsvpMail = keyof typeof kinds

/**
 * Sends one RSVP's confirmation or reminder, at most once. The job claims the RSVP's sent-at column first, in one
 * statement, so a retried or duplicate job finds it taken and stops. If the provider refuses, the claim goes back and
 * the error reaches the queue, which tries again. An RSVP cancelled before the job runs, or an event that has
 * started, sends nothing.
 */
export async function sendRsvpMail(kind: RsvpMail, rsvpId: number) {
  const { sent, mark, render, subject } = kinds[kind]
  const [claimed] = await db.update(rsvps).set(mark(new Date()))
    .where(and(eq(rsvps.id, rsvpId), isNull(sent)))
    .returning({ id: rsvps.id })
  if (!claimed) return

  const [details] = await db.select({
    name: users.name,
    to: users.email,
    title: events.title,
    slug: events.slug,
    venue: events.venue,
    city: events.city,
    startsAt: events.startsAt,
    timeZone: events.timeZone,
  }).from(rsvps)
    .innerJoin(users, eq(users.id, rsvps.userId))
    .innerJoin(events, eq(events.id, rsvps.eventId))
    .where(and(eq(rsvps.id, rsvpId), gt(events.startsAt, new Date())))
    .limit(1)
  if (!details) return

  const { mail, public: { siteUrl } } = useRuntimeConfig()
  // The guest reads the mail anywhere, so give the time where the event happens, and name the zone.
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: details.timeZone }).format(details.startsAt)
  // Template bindings are escaped, so a title like "<b>Free</b>" stays text in the HTML part.
  const body = await renderEmailMarkdown(await render({
    name: details.name,
    title: details.title,
    when: `${when} (${details.timeZone.replaceAll("_", " ")} time)`,
    where: `${details.venue}, ${details.city}`,
    // Jobs have no request to take an origin from, and a Host header is the client's to choose. Production sets
    // NUXT_PUBLIC_SITE_URL; without it (local dev) links point at the dev server's default address.
    url: new URL(`/events/${details.slug}`, siteUrl || "http://localhost:3000").href,
  }))

  const [error] = await email.send({ ...body, from: mail.from, to: details.to, subject: subject(details.title) })
  if (error) {
    // Logged here because the queue's own log keeps only "Queue Delivery failed", not the provider's reason.
    console.error(`The ${kind} for RSVP ${rsvpId} wasn't sent: ${error.code}`, error)
    await db.update(rsvps).set(mark(null)).where(eq(rsvps.id, rsvpId))
    throw error
  }
}

/**
 * The password reset link. Sent straight away rather than through a job: the link carries a token, and a queued job
 * would keep it on disk. Better Auth calls this after answering, so the response time doesn't reveal whether the
 * address has an account. The visitor can ask again if it doesn't arrive.
 */
export async function sendPasswordReset(user: { name: string, email: string }, url: string) {
  const body = await renderEmailMarkdown(await renderReset({ name: user.name, url }))
  const [error] = await email.send({ ...body, from: useRuntimeConfig().mail.from, to: user.email, subject: "Reset your Meetups password" })
  if (error) console.error(`The password reset for ${user.email} wasn't sent: ${error.code}`, error)
}
