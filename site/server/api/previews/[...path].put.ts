import { createError, defineHandler, getRouterParam } from "h3"
import { blob } from "vite-hub/blob"
import { requireIngestToken } from "../../utils/ingest"

/**
 * Stores a part of a Preview snapshot (`evals push` builds it: the app's node_modules, installed as a WebContainer
 * would) or its manifest. Paths: `<scope>/<id>/manifest.json` and `<scope>/<id>/<sha256>.<n>.bin`.
 */
export default defineHandler(async (event) => {
  requireIngestToken(event)
  const path = getRouterParam(event, "path") ?? ""
  if (!/^(?:runs|projects)\/[\w.-]+\/(?:manifest\.json|[a-f0-9]{64}\.\d+\.bin)$/.test(path)) throw createError({ status: 400, message: "Bad preview path." })
  const body = new Uint8Array(await event.req.arrayBuffer())
  const [error] = await blob.put(`previews/${path}`, body, { contentType: path.endsWith(".json") ? "application/json" : "application/octet-stream" })
  if (error) throw error
  return { path, bytes: body.byteLength }
})
