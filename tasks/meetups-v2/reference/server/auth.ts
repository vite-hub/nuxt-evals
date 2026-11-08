import { useRuntimeConfig } from "nuxt/server"
import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"

// Better Auth reads BETTER_AUTH_SECRET from the environment. The callback runs per request, so the
// site URL comes from runtime config (NUXT_PUBLIC_SITE_URL) instead of being baked into the build.
export default defineAuth(() => ({
  appName: "Meetups",
  baseURL: useRuntimeConfig().public.siteUrl,
  database: authDatabase(),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
}))
