import { passkeyClient } from "@better-auth/passkey/client"
import { createAuthClient } from "better-auth/vue"

export const authClient = createAuthClient({ plugins: [passkeyClient()] })
