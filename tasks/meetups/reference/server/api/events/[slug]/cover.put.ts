import { and, eq, isNull } from "drizzle-orm"
import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { blob, ensureBlob } from "vite-hub/blob"
import { detectContentType } from "vite-hub/blob/content-type"
import { db, schema } from "vite-hub/database/drizzle"
import { requireRateLimit } from "vite-hub/rate-limit"
import { COVER_MAX_MB, COVER_TYPES } from "#shared/utils/cover"
import { findOwnedEvent } from "#server/utils/events"
import { requireUser } from "#server/utils/session"

/** Sets or replaces the event's cover photo. Only its organizer may. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const found = await findOwnedEvent(getRouterParam(event, "slug")!, user.id)
  await requireRateLimit(event.req, "cover-upload", { limit: 20, window: "1h", key: user.id })

  const file = (await event.req.formData()).get("cover")
  if (!(file instanceof File)) throw createError({ status: 400, statusText: "Choose a photo to upload." })
  // ensureBlob checks the size and the type the browser declared; the bytes must agree, so a renamed file can't pass.
  ensureBlob(file, { maxSize: `${COVER_MAX_MB}MB`, types: [...COVER_TYPES] })
  const type = detectContentType(new Uint8Array(await file.slice(0, 64).arrayBuffer()))
  if (type !== file.type) throw createError({ status: 400, statusText: "That file isn't a JPEG, PNG or WebP photo." })

  // A fresh path per upload: browsers and CDNs may cache /images/<path> for good.
  const [putError, stored] = await blob.put(`covers/${found.id}/cover`, file, { contentType: type, addRandomSuffix: true })
  if (putError) throw putError

  // Swap only if nobody changed the cover since we read the event, so a parallel upload can't orphan a photo.
  const { events } = schema
  const swapped = await db.update(events).set({ coverPath: stored.pathname })
    .where(and(eq(events.id, found.id), found.coverPath ? eq(events.coverPath, found.coverPath) : isNull(events.coverPath)))
    .returning({ id: events.id })
  const orphan = swapped.length ? found.coverPath : stored.pathname
  if (orphan) {
    const [deleteError] = await blob.del(orphan)
    if (deleteError) console.error(`Couldn't delete cover ${orphan}`, deleteError)
  }
  if (!swapped.length) throw createError({ status: 409, statusText: "The cover changed while you uploaded. Try again." })
  return { coverPath: stored.pathname }
})
