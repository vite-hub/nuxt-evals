import { defineEventHandler, getValidatedQuery } from "nuxt/server"
import { z } from "zod"
import { cities, listEvents, seatsLeft } from "../../data/events"

const pageSize = 20

const querySchema = z.object({
  q: z.string().trim().optional(),
  city: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
})

export default defineEventHandler(async (event) => {
  const { q, city, page } = await getValidatedQuery(event, querySchema)
  const now = Date.now()
  const needle = q?.toLowerCase()
  const matches = listEvents().filter(item =>
    Date.parse(item.startsAt) > now
    && (!needle || item.title.toLowerCase().includes(needle))
    && (!city || item.city === city))
  return {
    cities,
    total: matches.length,
    pageSize,
    events: matches.slice((page - 1) * pageSize, page * pageSize).map(item => ({
      slug: item.slug,
      title: item.title,
      city: item.city,
      startsAt: item.startsAt,
      seatsLeft: seatsLeft(item),
    })),
  }
})
