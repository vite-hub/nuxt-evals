import { passkeyClient } from "@better-auth/passkey/client"
import { createAuthClient } from "vite-hub/auth/vue"

/** Better Auth's client with the passkey calls. ViteHub's version loads Better Auth on first use, on pages that sign in. */
export const authClient = createAuthClient({ plugins: [passkeyClient()] })
