import { defineComments } from "vite-hub/comments"

// On pages the author is the Auth session (server/auth.ts); in the Console, the person the Console signed. Sign-up
// closes after the first account, so any signed-in user is Maxi; visitors get nothing.
export const comments = defineComments({
  authorize: ({ user }) => Boolean(user),
})
