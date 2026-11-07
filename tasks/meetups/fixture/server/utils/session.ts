import { getCookie, type RequestEvent } from "nuxt/server"
import { findUser, type User } from "../data/users"

export const sessionCookie = "meetups_session"

/** Production keeps sessions in a remote store. A lookup takes about 15 ms. */
const storeLatencyMs = 15

/** The signed-in user, or null for anonymous visitors. */
export async function getSessionUser(event: RequestEvent): Promise<User | null> {
  const id = getCookie(event, sessionCookie)
  await new Promise(resolve => setTimeout(resolve, storeLatencyMs))
  return (id && findUser(id)) || null
}
