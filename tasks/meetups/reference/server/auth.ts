import { APIError, createAuthMiddleware } from "better-auth/api"
import { useRuntimeConfig } from "nuxt/server"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"
import { PASSWORD_MAX, PASSWORD_MIN, signUpSchema } from "#shared/schemas/auth"

// Better Auth reads BETTER_AUTH_SECRET from the environment. The callback runs per request.
// Behind an HTTPS proxy the request looks like plain http, so production sets NUXT_PUBLIC_SITE_URL:
// it makes the origin check pass and the session cookie Secure.
export default defineAuth(({ requestOrigin }) => ({
  appName: "Meetups",
  baseURL: useRuntimeConfig().public.siteUrl || requestOrigin,
  database: authDatabase(),
  emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN, maxPasswordLength: PASSWORD_MAX },
  // server/middleware/auth-rate-limit.ts limits sign-in per client instead (see why there).
  rateLimit: { enabled: false },
  hooks: {
    // The sign-up form's rules, repeated on the server: the trimmed name is what gets saved.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return
      const result = signUpSchema.safeParse(ctx.body)
      if (!result.success) throw new APIError("BAD_REQUEST", { message: result.error.issues[0]!.message })
      return { context: { ...ctx, body: { ...ctx.body, name: result.data.name } } }
    }),
  },
}))
