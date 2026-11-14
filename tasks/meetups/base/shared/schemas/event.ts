import { z } from "zod"
import { canonicalTimeZone, instantToZonedLocal, zonedLocalToInstant } from "../utils/time"

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

function startInstant(startsAtLocal: string, timeZone: string): Date | null {
  if (!LOCAL_DATE_TIME.test(startsAtLocal) || !canonicalTimeZone(timeZone)) return null
  return zonedLocalToInstant(startsAtLocal, timeZone)
}

export const eventInputSchema = z.object({
  title: z.string().trim().min(3, "Give the event a title of at least 3 characters").max(120, "Keep the title to 120 characters or fewer"),
  description: z.string().trim().min(20, "Tell people a bit more (20 characters or more)").max(5000, "Keep the description to 5,000 characters or fewer"),
  city: z.string().trim().min(2, "Which city?").max(80, "Keep the city to 80 characters or fewer"),
  venue: z.string().trim().min(2, "Where exactly?").max(160, "Keep the venue to 160 characters or fewer"),
  startsAtLocal: z.string().regex(LOCAL_DATE_TIME, "Pick a date and time"),
  timeZone: z.string().transform((value, ctx) => {
    const zone = canonicalTimeZone(value)
    if (!zone) ctx.addIssue({ code: "custom", message: "Pick a time zone from the list" })
    return zone ?? value
  }),
  capacity: z.int("Seats must be a whole number").min(1, "At least 1 seat").max(5000, "5,000 seats at most"),
  priceCents: z.int("Use whole cents").min(0, "The price can't be negative").max(100_000, "Keep the price at €1,000 or less"),
}).superRefine(({ startsAtLocal, timeZone }, ctx) => {
  const instant = startInstant(startsAtLocal, timeZone)
  if (instant && (Number.isNaN(instant.getTime()) || instantToZonedLocal(instant, timeZone) !== startsAtLocal)) {
    ctx.addIssue({ code: "custom", path: ["startsAtLocal"], message: "That time doesn't exist at the venue. Pick another." })
  }
})

export const newEventSchema = eventInputSchema.superRefine(({ startsAtLocal, timeZone }, ctx) => {
  const instant = startInstant(startsAtLocal, timeZone)
  if (instant && instant.getTime() <= Date.now()) {
    ctx.addIssue({ code: "custom", path: ["startsAtLocal"], message: "Pick a time in the future" })
  }
})

export type EventInput = z.input<typeof eventInputSchema>

export const eventsQuerySchema = z.object({
  q: z.string().trim().max(100).catch("").transform(value => value || undefined),
  city: z.string().trim().max(80).catch("").transform(value => value || undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
})

export const EVENTS_PAGE_SIZE = 12
