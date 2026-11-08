import { createError, type RequestEvent } from "nuxt/server"
import { auth } from "vite-hub/auth/server"

/** The signed-in user, or null. */
export async function getSessionUser(event: RequestEvent) {
  const session = await auth.api.getSession({ headers: event.req.headers })
  return session?.user ?? null
}

/** The signed-in user. Throws 401 for anyone else, so the rest of the handler only runs for a user. */
export async function requireUser(event: RequestEvent) {
  const user = await getSessionUser(event)
  if (!user) throw createError({ status: 401, statusText: "Sign in first" })
  return user
}
