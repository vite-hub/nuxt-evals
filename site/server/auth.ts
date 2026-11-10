import { passkey } from "@better-auth/passkey"
import { APIError } from "better-auth/api"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"

/**
 * One account: Maxi's. Sign-up closes once a user exists, so the first account is the only one. It signs in with a
 * passkey (Bitwarden), with the password as a fallback, and it is who Comments and the Content editor let in.
 */
export default defineAuth(({ requestOrigin }) => ({
  baseURL: requestOrigin,
  database: authDatabase(),
  emailAndPassword: { enabled: true },
  plugins: [passkey({ rpName: "Nuxt agent evals" })],
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const users = await ctx?.context.adapter.count({ model: "user" })
          if (users) throw new APIError("FORBIDDEN", { message: "This site has its one account already." })
          return { data: user }
        },
      },
    },
  },
}))
