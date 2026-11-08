import { z } from "zod"
import { isTimeZone } from "../utils/time"

/** One schema for the event form in the browser and for the request body on the server. */
export const eventInputSchema = z.object({
  title: z.string().trim().min(3, "Give the event a title of at least 3 characters").max(120),
  description: z.string().trim().min(20, "Tell people a bit more (20 characters or more)").max(5000),
  city: z.string().trim().min(2, "Which city?").max(80),
  venue: z.string().trim().min(2, "Where exactly?").max(160),
  /** The wall-clock start at the venue, as an `<input type="datetime-local">` gives it. */
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time"),
  timeZone: z.string().refine(isTimeZone, "Pick a valid time zone"),
  capacity: z.int("Seats must be a whole number").min(1, "At least 1 seat").max(5000),
  priceCents: z.int().min(0).max(100_000),
})

export type EventInput = z.infer<typeof eventInputSchema>

/** The list filters, read from the URL by the page and by the API with the same rules. */
export const eventsQuerySchema = z.object({
  q: z.string().trim().max(100).catch("").transform(value => value || undefined),
  city: z.string().trim().max(80).catch("").transform(value => value || undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
})

export type EventsQuery = z.infer<typeof eventsQuerySchema>

export const EVENTS_PAGE_SIZE = 12
