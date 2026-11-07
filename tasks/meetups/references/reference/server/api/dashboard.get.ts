import { createError, defineEventHandler } from "nuxt/server"
import { listEvents, seatsLeft } from "../data/events"

const day = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ status: 401, message: "Sign in first" })
  if (user.role !== "organizer") throw createError({ status: 403, message: "Only organizers can open the dashboard" })

  const now = Date.now()
  const mine = listEvents().filter(item => item.organizerId === user.id)
  const today = new Date(now).toISOString().slice(0, 10)
  const days = Array.from({ length: 14 }, (_, index) => new Date(Date.parse(today) - (13 - index) * day).toISOString().slice(0, 10))
  const perDay = new Map(days.map(date => [date, 0]))
  for (const item of mine) {
    for (const attendee of item.attendees) {
      const date = attendee.rsvpAt.slice(0, 10)
      if (perDay.has(date)) perDay.set(date, perDay.get(date)! + 1)
    }
  }
  return {
    events: mine.filter(item => Date.parse(item.startsAt) > now).slice(0, 10).map(item => ({
      slug: item.slug,
      title: item.title,
      startsAt: item.startsAt,
      rsvps: item.attendees.length,
      seatsLeft: seatsLeft(item),
      attendees: item.attendees.map(({ name, email, seats }) => ({ name, email, seats })),
    })),
    rsvpsPerDay: days.map(date => ({ date, count: perDay.get(date)! })),
  }
})
