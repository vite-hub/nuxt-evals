import { createError, type H3Event } from "h3"
import { useRuntimeConfig } from "nitro/runtime-config"

const sha256 = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))

/**
 * The runner posts results with `Authorization: Bearer <NUXT_INGEST_TOKEN>`. The header and the token are compared as
 * SHA-256 digests, byte by byte to the end, so the time taken does not tell how much of a guess was right.
 */
export async function requireIngestToken(event: H3Event): Promise<void> {
  const expected = useRuntimeConfig().ingestToken
  if (typeof expected !== "string" || !expected) throw createError({ status: 401, message: "Send the ingest token." })
  const [sent, wanted] = await Promise.all([sha256(event.req.headers.get("authorization") ?? ""), sha256(`Bearer ${expected}`)])
  let difference = 0
  for (const [index, byte] of sent.entries()) difference |= byte ^ (wanted[index] ?? 0)
  if (difference) throw createError({ status: 401, message: "Send the ingest token." })
}
