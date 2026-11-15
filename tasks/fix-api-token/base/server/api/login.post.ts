import { createError, defineEventHandler, readValidatedBody } from "nuxt/server"
import { z } from "zod"
import { signIn } from "../utils/store"

const Body = z.object({ email: z.email(), password: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, Body)
  const token = signIn(email, password)
  if (!token) throw createError({ status: 401, statusText: "Wrong email or password" })
  return { token }
})
