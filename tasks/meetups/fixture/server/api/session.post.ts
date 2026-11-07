import { createError, defineEventHandler, readBody, setCookie } from "nuxt/server"
import { findUser } from "../data/users"

/** Demo sign-in: picks a user by id. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: string }>(event)
  const user = body?.userId ? findUser(body.userId) : undefined
  if (!user) throw createError({ status: 400, message: "Unknown user." })
  setCookie(event, sessionCookie, user.id, { httpOnly: true, sameSite: "lax", path: "/" })
  return user
})
