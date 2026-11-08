import { eq } from "drizzle-orm"
import { createError, defineEventHandler, getRouterParam, sendRedirect } from "nuxt/server"
import { z } from "zod"
import { db, schema } from "vite-hub/database/drizzle"

/** Links from the old site, /e/<id>, move for good to /events/<slug>. */
export default defineEventHandler(async (event) => {
  const id = z.coerce.number().int().positive().safeParse(getRouterParam(event, "id"))
  if (!id.success) throw createError({ status: 404, statusText: "Event not found" })
  const [found] = await db.select({ slug: schema.events.slug }).from(schema.events)
    .where(eq(schema.events.id, id.data)).limit(1)
  if (!found) throw createError({ status: 404, statusText: "Event not found" })

  return sendRedirect(event, `/events/${found.slug}`, 301)
})
