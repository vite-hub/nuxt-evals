import { defineEventHandler, getRequestHeader, getRequestIP, useRuntimeConfig } from "nuxt/server"
import { requireRateLimit } from "vite-hub/rate-limit"

const GUARDED = new Set(["/api/auth/sign-in/email", "/api/auth/sign-up/email"])

/**
 * Limits password sign-in and sign-up per client: 10 a minute. Better Auth's own limiter is off (server/auth.ts):
 * it can't see the client address on plain Node, so it shares one bucket and a few bad tries lock everyone out.
 * Behind a proxy, set NUXT_TRUST_PROXY=true so the client comes from X-Forwarded-For instead of the proxy's address.
 * Only the last entry counts: the proxy appends it, while the entries before it come from the client and can be forged.
 */
function clientAddress(event: Parameters<typeof getRequestIP>[0]): string | undefined {
  // The override can arrive as the string "false" from NUXT_TRUST_PROXY=false, which is truthy. Only "true" trusts.
  if (String(useRuntimeConfig().trustProxy) !== "true") return getRequestIP(event)
  return getRequestHeader(event, "x-forwarded-for")?.split(",").at(-1)?.trim() || getRequestIP(event)
}

export default defineEventHandler(async (event) => {
  if (event.req.method !== "POST" || !GUARDED.has(event.url.pathname)) return
  const client = clientAddress(event)
  // A request with no address at all (no socket, no header) shares one bucket with the others like it.
  await requireRateLimit(event.req, "sign-in", { limit: 10, window: "1m", key: client ?? "unknown-client" })
})
