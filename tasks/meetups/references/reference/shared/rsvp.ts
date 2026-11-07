import { z } from "zod"

export const rsvpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.email("Enter a valid email address"),
  seats: z.number().int().min(1, "Book at least 1 seat").max(4, "Book at most 4 seats"),
})

export type RsvpInput = z.infer<typeof rsvpSchema>
