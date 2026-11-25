import { createError, defineHandler, getRouterParam } from "h3"
import { blob } from "vite-hub/blob"

/** A Preview snapshot's manifest or one of its parts. Parts are named by their snapshot's hash, so they never change. */
export default defineHandler(async (event) => {
  const path = getRouterParam(event, "path") ?? ""
  if (!/^(?:runs|projects)\/[\w.-]+\/(?:manifest\.json|[a-f0-9]{64}\.\d+\.bin)$/.test(path)) throw createError({ status: 400, message: "Bad preview path." })
  // 404 for a run without a snapshot: the Preview then installs with npm.
  const { url, method, headers } = event.req
  const request = new Request(url, { method, headers })
  return await blob.serve(request, `previews/${path}`, {
    cacheControl: path.endsWith(".json") ? "public, max-age=60" : "public, max-age=31536000, immutable",
  })
})
