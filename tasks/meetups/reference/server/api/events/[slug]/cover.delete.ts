import { and, eq } from "drizzle-orm"
import { defineEventHandler, getRouterParam } from "nuxt/server"
import { blob } from "vite-hub/blob"
import { db, schema } from "vite-hub/database/drizzle"
import { findOwnedEvent } from "#server/utils/events"
import { requireUser } from "#server/utils/session"

/** Removes the event's cover photo, from the event and from storage. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const found = await findOwnedEvent(getRouterParam(event, "slug")!, user.id)
  if (!found.coverPath) return { coverPath: null }

  const { events } = schema
  const cleared = await db.update(events).set({ coverPath: null })
    .where(and(eq(events.id, found.id), eq(events.coverPath, found.coverPath)))
    .returning({ id: events.id })
  if (cleared.length) {
    const [error] = await blob.del(found.coverPath)
    if (error) console.error(`Couldn't delete cover ${found.coverPath}`, error)
  }
  return { coverPath: null }
})
