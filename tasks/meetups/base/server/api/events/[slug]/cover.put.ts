import { and, eq, isNull } from "drizzle-orm"
import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { blob, ensureBlob } from "vite-hub/blob"
import { detectContentType } from "vite-hub/blob/content-type"
import { db, schema } from "vite-hub/database/drizzle"
import { requireRateLimit } from "vite-hub/rate-limit"
import { COVER_MAX_BYTES, COVER_MAX_MB, COVER_TYPES } from "#shared/utils/cover"
import { findOwnedEvent } from "#server/utils/events"
import { requireUser } from "#server/utils/session"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const found = await findOwnedEvent(getRouterParam(event, "slug")!, user.id)
  await requireRateLimit(event.req, "cover-upload", { limit: 20, window: "1h", key: user.id })

  const length = Number(event.req.headers.get("content-length"))
  if (!length) throw createError({ status: 411, statusText: "Send the photo as a form with its length." })
  if (length > COVER_MAX_BYTES + 64 * 1024) throw createError({ status: 413, statusText: `That photo is over ${COVER_MAX_MB} MB.` })
  const form = await event.req.formData().catch(() => undefined)
  const file = form?.get("cover")
  if (!(file instanceof File)) throw createError({ status: 400, statusText: "Choose a photo to upload." })
  ensureBlob(file, { maxSize: `${COVER_MAX_MB}MB`, types: [...COVER_TYPES] })
  const type = detectContentType(new Uint8Array(await file.slice(0, 64).arrayBuffer()))
  if (type !== file.type) throw createError({ status: 400, statusText: "That file isn't a JPEG, PNG or WebP photo." })

  const [putError, stored] = await blob.put(`covers/${found.id}/cover`, file, { contentType: type, addRandomSuffix: true })
  if (putError) throw putError

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
