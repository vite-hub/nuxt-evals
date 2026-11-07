import { defineEventHandler, getQuery } from "nuxt/server"
import { listEvents, seatsLeft } from "../../data/events"

export default defineEventHandler((event) => {
  const { q, city, page } = getQuery<{ q?: string, city?: string, page?: string }>(event)
  const now = Date.now()
  const matches = listEvents().filter(item =>
    Date.parse(item.startsAt) > now
    && (!q || item.title.toLowerCase().includes(q.toLowerCase()))
    && (!city || item.city === city))
  const current = Number(page ?? 1)
  return {
    total: matches.length,
    pageSize: 20,
    events: matches.slice((current - 1) * 20, current * 20).map(item => ({ ...item, seatsLeft: seatsLeft(item) })),
  }
})
