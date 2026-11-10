import { passkey } from "@better-auth/passkey"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { useRuntimeConfig } from "nuxt/server"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"
import { PASSWORD_MAX, PASSWORD_MIN, signUpSchema } from "#shared/schemas/auth"

// Better Auth reads BETTER_AUTH_SECRET from the environment. The callback runs per request.
// Behind an HTTPS proxy the request looks like plain http, so production sets NUXT_PUBLIC_SITE_URL:
// it makes the origin check pass, the session cookie Secure, and passkeys belong to the public domain.
export default defineAuth(({ requestOrigin }) => {
  const { public: { siteUrl }, trustProxy } = useRuntimeConfig()
  const origin = siteUrl || requestOrigin
  return {
    appName: "Meetups",
    baseURL: origin,
    database: authDatabase(),
    emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN, maxPasswordLength: PASSWORD_MAX },
    // A passkey is bound to a domain. Better Auth's default is "localhost", so a deployed site names its own.
    plugins: [passkey({ rpName: "Meetups", rpID: new URL(origin).hostname, origin })],
    // Better Auth's limiter (3 sign-ins per 10 s per client, counters in the database) is on outside dev. It counts
    // the address the host reports. Behind a proxy that sets X-Forwarded-For to the client, NUXT_TRUST_PROXY=true
    // counts that instead. The override arrives as the string "true" or "false", so compare the text.
    advanced: { trustedProxyHeaders: String(trustProxy) === "true" },
    hooks: {
      // The sign-up form's rules, repeated on the server: the trimmed name is what gets saved.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return
        const result = signUpSchema.safeParse(ctx.body)
        if (!result.success) throw new APIError("BAD_REQUEST", { message: result.error.issues[0]!.message })
        return { context: { ...ctx, body: { ...ctx.body, name: result.data.name } } }
      }),
    },
  }
})
