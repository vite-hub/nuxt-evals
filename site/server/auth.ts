import { passkey } from "@better-auth/passkey"
import { APIError } from "better-auth/api"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"

/**
 * Users that Site access in the Console makes: guests (role `guest`) and Console members (role `console`). ViteHub
 * declares `role` with `input: false`, so sign-up input can't set it and only the Console does; a placeholder email
 * alone proves nothing.
 */
const fromSiteAccess = (user: Record<string, unknown>) =>
  typeof user.role === "string" && user.role.split(",").some(role => role === "guest" || role === "console")

/**
 * One account: Maxi's. Sign-up closes once a user exists, so the first account is the only one. It signs in with a
 * passkey (Bitwarden), with the password as a fallback. Site access in console.vitehub.dev also signs browsers in: a
 * Console member as the app user with their Console email (made on first use), and guests that can only comment.
 * Their roles stay in `user.role`, a field that ViteHub Auth declares itself. A browser stays signed in for 90 days after
 * its last visit.
 */
export default defineAuth(({ requestOrigin }) => ({
  baseURL: requestOrigin,
  database: authDatabase(),
  emailAndPassword: { enabled: true },
  session: { expiresIn: 60 * 60 * 24 * 90 },
  plugins: [passkey({ rpName: "Nuxt agent evals" })],
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          if (fromSiteAccess(user)) return { data: user }
          const users = await ctx?.context.adapter.count({ model: "user" })
          if (users) throw new APIError("FORBIDDEN", { message: "This site has its one account already." })
          return { data: user }
        },
      },
    },
  },
}))
