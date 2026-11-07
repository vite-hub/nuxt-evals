import { defineEventHandler, deleteCookie } from "nuxt/server"

export default defineEventHandler((event) => {
  deleteCookie(event, sessionCookie, { path: "/" })
  return { ok: true }
})
