import { z } from "zod"
import { canonicalTimeZone, instantToZonedLocal, zonedLocalToInstant } from "../utils/time"

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** The start as an instant, or null while the field or the zone is still invalid (their own issues report that). */
function startInstant(startsAtLocal: string, timeZone: string): Date | null {
  if (!LOCAL_DATE_TIME.test(startsAtLocal) || !canonicalTimeZone(timeZone)) return null
  return zonedLocalToInstant(startsAtLocal, timeZone)
}

/** One schema for the event form in the browser and for the request body on the server. */
export const eventInputSchema = z.object({
  title: z.string().trim().min(3, "Give the event a title of at least 3 characters").max(120),
  description: z.string().trim().min(20, "Tell people a bit more (20 characters or more)").max(5000),
  city: z.string().trim().min(2, "Which city?").max(80),
  venue: z.string().trim().min(2, "Where exactly?").max(160),
  /** The wall-clock start at the venue, as an `<input type="datetime-local">` gives it. */
  startsAtLocal: z.string().regex(LOCAL_DATE_TIME, "Pick a date and time"),
  timeZone: z.string().transform((value, ctx) => {
    const zone = canonicalTimeZone(value)
    if (!zone) ctx.addIssue({ code: "custom", message: "Pick a time zone from the list" })
    return zone ?? value
  }),
  capacity: z.int("Seats must be a whole number").min(1, "At least 1 seat").max(5000),
  priceCents: z.int().min(0).max(100_000),
}).superRefine(({ startsAtLocal, timeZone }, ctx) => {
  // Feb 31, 25:00, or 02:30 on the night the clocks jump forward don't exist at the venue.
  const instant = startInstant(startsAtLocal, timeZone)
  if (instant && (Number.isNaN(instant.getTime()) || instantToZonedLocal(instant, timeZone) !== startsAtLocal)) {
    ctx.addIssue({ code: "custom", path: ["startsAtLocal"], message: "That time doesn't exist at the venue. Pick another." })
  }
})

/** A new event must start in the future. Editing keeps the plain schema, so a past event can still be corrected. */
export const newEventSchema = eventInputSchema.superRefine(({ startsAtLocal, timeZone }, ctx) => {
  const instant = startInstant(startsAtLocal, timeZone)
  if (instant && instant.getTime() <= Date.now()) {
    ctx.addIssue({ code: "custom", path: ["startsAtLocal"], message: "Pick a time in the future" })
  }
})

export type EventInput = z.input<typeof eventInputSchema>

/** The list filters, read from the URL by the page and by the API with the same rules. */
export const eventsQuerySchema = z.object({
  q: z.string().trim().max(100).catch("").transform(value => value || undefined),
  city: z.string().trim().max(80).catch("").transform(value => value || undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
})

export const EVENTS_PAGE_SIZE = 12
