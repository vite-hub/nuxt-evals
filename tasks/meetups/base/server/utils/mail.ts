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
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: details.timeZone }).format(details.startsAt)
  const body = await renderEmailMarkdown(await render({
    name: details.name,
    title: details.title,
    when: `${when} (${details.timeZone.replaceAll("_", " ")} time)`,
    where: `${details.venue}, ${details.city}`,
    url: new URL(`/events/${details.slug}`, siteUrl || "http://localhost:3000").href,
  }))

  const [error] = await email.send({ ...body, from: mail.from, to: details.to, subject: subject(details.title) })
  if (error) {
    console.error(`The ${kind} for RSVP ${rsvpId} wasn't sent: ${error.code}`, error)
    await db.update(rsvps).set(mark(null)).where(eq(rsvps.id, rsvpId))
    throw error
  }
}

export async function sendPasswordReset(user: { name: string, email: string }, url: string) {
  const body = await renderEmailMarkdown(await renderReset({ name: user.name, url }))
  const [error] = await email.send({ ...body, from: useRuntimeConfig().mail.from, to: user.email, subject: "Reset your Meetups password" })
  if (error) console.error(`The password reset for ${user.email} wasn't sent: ${error.code}`, error)
}
