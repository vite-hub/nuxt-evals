import { defineEventHandler } from "h3"
import { readValidatedBody, setResponseStatus } from "nuxt/server"
import { requireRateLimit } from "vite-hub/rate-limit"
import { newEventSchema } from "#shared/schemas/event"
import { zonedLocalToInstant } from "#shared/utils/time"
import { slugify } from "#server/utils/events"
import { requireUser } from "#server/utils/session"
import { db, schema } from "vite-hub/database/drizzle"

// h3's handler, not nuxt/server's: its event carries waitUntil() and the client address that Rate Limit reads.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await requireRateLimit(event, "create-event", { limit: 10, window: "1h", key: user.id })
  const { startsAtLocal, ...input } = await readValidatedBody(event, newEventSchema)

  const [created] = await db.insert(schema.events).values({
    ...input,
    slug: slugify(input.title),
    startsAt: zonedLocalToInstant(startsAtLocal, input.timeZone),
    organizerId: user.id,
  }).returning({ slug: schema.events.slug })

  setResponseStatus(event, 201)
  return created!
})
