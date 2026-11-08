import { defineAuth } from "vite-hub/auth"
import { authDatabase } from "vite-hub/auth/database"

export default defineAuth({
  appName: "Meetups",
  database: authDatabase(),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
})
