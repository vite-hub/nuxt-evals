import { useRuntimeConfig } from "nuxt/server"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"

// Better Auth reads BETTER_AUTH_SECRET from the environment. The callback runs per request.
// Behind an HTTPS proxy the request looks like plain http, so production sets NUXT_PUBLIC_SITE_URL:
// it makes the origin check pass and the session cookie Secure.
export default defineAuth(({ requestOrigin }) => ({
  appName: "Meetups",
  baseURL: useRuntimeConfig().public.siteUrl || requestOrigin,
  database: authDatabase(),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  // server/middleware/auth-rate-limit.ts limits sign-in per client instead (see why there).
  rateLimit: { enabled: false },
}))
