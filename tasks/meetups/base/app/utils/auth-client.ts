import { passkeyClient } from "@better-auth/passkey/client"
import { createAuthClient } from "vite-hub/auth/vue"

export const authClient = createAuthClient({ plugins: [passkeyClient()] })
