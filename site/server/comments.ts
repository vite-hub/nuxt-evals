import { commentsRoleAllows, defineComments } from "vite-hub/comments"

// On pages the author is the Auth session (server/auth.ts); in the Console, the person the Console signed. Maxi's
// account may do everything. Guests that Site access invited carry the `guest` role and may do what their
// `comments-*` roles allow. Visitors get nothing.
export const comments = defineComments({
  authorize: ({ user, action }) => {
    if (!user) return false
    const roles = typeof user.role === "string" ? user.role.split(",") : []
    return roles.includes("guest") ? commentsRoleAllows(user, action) : true
  },
})
