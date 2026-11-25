import { asc, gte } from "drizzle-orm"
import { defineCachedFunction } from "nitro/cache"
import { defineEventHandler } from "nuxt/server"
import { db, schema } from "vite-hub/database/drizzle"

/** Cities with upcoming events, for the filter. The same for every visitor, so cached for a minute. */
const upcomingCities = defineCachedFunction(async () => {
  const rows = await db.selectDistinct({ city: schema.events.city }).from(schema.events)
    .where(gte(schema.events.startsAt, new Date()))
    .orderBy(asc(schema.events.city))
  return rows.map(row => row.city)
}, { name: "cities", maxAge: 60, swr: true })

export default defineEventHandler(() => upcomingCities())
