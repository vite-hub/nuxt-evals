import { defineConsoleAuthorize } from "vite-hub/console/auth"

export default defineConsoleAuthorize(() => ({ sections: ["databases:read", "blob:read"] }))
