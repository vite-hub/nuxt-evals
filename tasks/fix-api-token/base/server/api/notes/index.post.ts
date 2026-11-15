import { defineEventHandler, readValidatedBody } from "nuxt/server"
import { z } from "zod"
import { addNote, requireUser } from "../../utils/store"

const Body = z.object({ title: z.string().trim().min(1).max(120), body: z.string().max(10_000) })

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  return addNote(user.id, await readValidatedBody(event, Body))
})
