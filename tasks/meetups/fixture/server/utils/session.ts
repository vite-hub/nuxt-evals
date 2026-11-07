import { getCookie, type RequestEvent } from "nuxt/server"
import { findUser, type User } from "../data/users"

export const sessionCookie = "meetups_session"

/** The signed-in user, or null for anonymous visitors. */
export async function getSessionUser(event: RequestEvent): Promise<User | null> {
  const id = getCookie(event, sessionCookie)
  return (id && findUser(id)) || null
}
