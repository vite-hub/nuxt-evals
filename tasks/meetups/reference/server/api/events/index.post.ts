import { defineEventHandler, readValidatedBody, setResponseStatus } from "nuxt/server"
import { requireRateLimit } from "vite-hub/rate-limit"
import { newEventSchema } from "#shared/schemas/event"
import { zonedLocalToInstant } from "#shared/utils/time"
import { slugify } from "#server/utils/events"
import { requireUser } from "#server/utils/session"
import { db, schema } from "vite-hub/database/drizzle"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { startsAtLocal, ...input } = await readValidatedBody(event, newEventSchema)
  // After validation, so a form with mistakes doesn't use up the hourly quota.
  await requireRateLimit(event.req, "create-event", { limit: 10, window: "1h", key: user.id })

  const [created] = await db.insert(schema.events).values({
    ...input,
    slug: slugify(input.title),
    startsAt: zonedLocalToInstant(startsAtLocal, input.timeZone),
    organizerId: user.id,
  }).returning({ slug: schema.events.slug })

  setResponseStatus(event, 201)
  return created!
})
