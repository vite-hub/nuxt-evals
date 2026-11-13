import { passkey } from "@better-auth/passkey"
import { APIError } from "better-auth/api"
import { admin } from "better-auth/plugins"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"

/** Site access in the Console makes its guests with this placeholder email domain. */
const guestEmail = /@guests\.invalid$/

/**
 * One account: Maxi's. Sign-up closes once a user exists, so the first account is the only one. It signs in with a
 * passkey (Bitwarden), with the password as a fallback. Site access in console.vitehub.dev signs browsers in as that
 * account, and makes guests that can only comment: `admin()` keeps their roles in `user.role`. A browser stays signed
 * in for 90 days after its last visit.
 */
export default defineAuth(({ requestOrigin }) => ({
  baseURL: requestOrigin,
  database: authDatabase(),
  emailAndPassword: { enabled: true },
  session: { expiresIn: 60 * 60 * 24 * 90 },
  plugins: [passkey({ rpName: "Nuxt agent evals" }), admin()],
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          if (guestEmail.test(user.email)) return { data: user }
          const users = await ctx?.context.adapter.count({ model: "user" })
          if (users) throw new APIError("FORBIDDEN", { message: "This site has its one account already." })
          return { data: user }
        },
      },
    },
  },
}))
