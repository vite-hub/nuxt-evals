import { createError, defineEventHandler, getRouterParam, readBody } from "nuxt/server"
import { addAttendee, seatsLeft } from "../../../data/events"

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string, email?: string, seats?: number }>(event)
  const errors: Record<string, string> = {}
  if (!body?.name?.trim()) errors.name = "Enter your name"
  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) errors.email = "Enter a valid email address"
  if (!Number.isInteger(body?.seats) || body!.seats! < 1 || body!.seats! > 4) errors.seats = "Seats must be between 1 and 4"
  if (Object.keys(errors).length) return { ok: false, errors }

  const updated = addAttendee(getRouterParam(event, "slug") ?? "", { name: body!.name!, email: body!.email!, seats: body!.seats! })
  if (!updated) throw createError({ status: 404, message: "Event not found" })
  await sendMail({ to: body!.email!, subject: `You're going to ${updated.title}`, text: `Hi ${body!.name}, see you there.` })
  return { ok: true, seatsLeft: seatsLeft(updated) }
})
