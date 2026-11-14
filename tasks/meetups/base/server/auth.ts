import { passkey } from "@better-auth/passkey"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { useRuntimeConfig } from "nuxt/server"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"
import { PASSWORD_MAX, PASSWORD_MIN, signUpSchema } from "#shared/schemas/auth"
import { sendPasswordReset } from "#server/utils/mail"

export default defineAuth(({ requestOrigin }) => {
  const { public: { siteUrl }, trustProxy } = useRuntimeConfig()
  const origin = siteUrl || requestOrigin
  return {
    appName: "Meetups",
    baseURL: origin,
    database: authDatabase(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      sendResetPassword: ({ user, url }) => sendPasswordReset(user, url),
      revokeSessionsOnPasswordReset: true,
    },
    plugins: [passkey({ rpName: "Meetups", rpID: new URL(origin).hostname, origin })],
    advanced: { trustedProxyHeaders: String(trustProxy) === "true" },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return
        const result = signUpSchema.safeParse(ctx.body)
        if (!result.success) throw new APIError("BAD_REQUEST", { message: result.error.issues[0]!.message })
        return { context: { ...ctx, body: { ...ctx.body, name: result.data.name } } }
      }),
    },
  }
})
