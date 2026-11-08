import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"

// Better Auth reads BETTER_AUTH_SECRET from the environment. The callback runs per request, and the
// app is same-origin, so the request's origin is the base URL on every host and port.
export default defineAuth(({ requestOrigin }) => ({
  appName: "Meetups",
  baseURL: requestOrigin,
  database: authDatabase(),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
}))
