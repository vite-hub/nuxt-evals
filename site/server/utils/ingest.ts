import { createError, type H3Event } from "h3"
import { useRuntimeConfig } from "nitro/runtime-config"

/** The runner posts results with `Authorization: Bearer <NUXT_INGEST_TOKEN>`. */
export function requireIngestToken(event: H3Event): void {
  const expected = useRuntimeConfig().ingestToken
  const header = event.req.headers.get("authorization")
  if (typeof expected !== "string" || !expected || header !== `Bearer ${expected}`) {
    throw createError({ status: 401, message: "Send the ingest token." })
  }
}
