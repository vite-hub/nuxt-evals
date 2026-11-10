import { getAuthForRequest, toAuthRequest } from "@vite-hub/auth/server"
import { defineComments } from "vite-hub/comments"

// The Console lives at console.vitehub.dev, so Comments can't take access from it: `identify` reads the Auth session
// (server/auth.ts). Sign-up closes after the first account, so any signed-in user is Maxi; visitors get nothing.
export const comments = defineComments({
  identify: async ({ event }) => {
    const request = toAuthRequest(event)
    const session = await getAuthForRequest(request).api.getSession({ headers: request.headers })
    return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null
  },
  authorize: ({ user }) => Boolean(user),
})
