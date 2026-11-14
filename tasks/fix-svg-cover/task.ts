import { fail, multipart, pass, type Reply, tinyPng, Visitor } from "../meetups/checks.ts"
import { fixTask } from "../meetups/fix.ts"

/**
 * Corpus BL2. The cover route checks the type the browser declared with `ensureBlob(file, { types: ["image"] })`, which
 * admits any `image/*`, SVG included, and the byte check is gone. An SVG with a script is stored and served from the
 * app's origin. Real: ViteHub `c62c0d2082` (#3998), Meetups rubric O6 and X9.
 */

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(document.domain)</script><rect width="10" height="10"/></svg>`)
const html = Buffer.from(`<!doctype html><html><body><script>alert(document.domain)</script></body></html>`)

/** Whether `bytes` start like a raster image a browser won't run: PNG, JPEG, GIF, WebP or AVIF. */
function raster(bytes: Buffer): boolean {
  const ascii = (from: number, to: number) => bytes.subarray(from, to).toString("latin1")
  return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    || bytes.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))
    || ascii(0, 4) === "GIF8"
    || (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    || (ascii(4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(8, 12)))
}

/** Uploads one cover to a new event of `organizer` and, when it is accepted, fetches what the app serves. */
async function upload(organizer: Visitor, file: { name: string, type: string, data: Buffer }) {
  const slug = await organizer.createEvent()
  const { body, headers } = multipart("cover", file)
  const reply = await organizer.send("PUT", `/api/events/${slug}/cover`, { body, headers })
  let served: Reply | undefined
  if (reply.status >= 200 && reply.status < 300) {
    const path = reply.json<{ coverPath?: string }>().coverPath
    if (path) served = await organizer.get(`/images/${path}`)
  }
  return { reply, served }
}

/** An upload is harmless when it is refused, or when what the app serves can't run in the app's origin. */
function harmless({ reply, served }: Awaited<ReturnType<typeof upload>>): { ok: boolean, said: string } {
  if (reply.status >= 400 && reply.status < 500) return { ok: true, said: `refused with ${reply.status}` }
  if (!served) return { ok: false, said: `answered ${reply.status}${reply.status < 300 ? " and isn't served at /images" : `: ${reply.text.slice(0, 120)}`}` }
  const type = String(served.headers["content-type"] ?? "none")
  const csp = String(served.headers["content-security-policy"] ?? "")
  const disposition = String(served.headers["content-disposition"] ?? "")
  const said = `accepted (${reply.status}), served ${served.status} as ${type}${csp ? `, CSP "${csp}"` : ""}${disposition ? `, ${disposition}` : ""}`
  const contained = /\bsandbox\b/.test(csp) || /^attachment/i.test(disposition)
  const image = /^image\/(png|jpeg|gif|webp|avif)\b/.test(type) && raster(served.body)
  return { ok: served.status >= 400 || contained || image, said }
}

export default fixTask({
  id: "fix-svg-cover",
  title: "A cover photo runs script",
  edits: [
    {
      path: "server/api/events/[slug]/cover.put.ts",
      find: `import { detectContentType } from "vite-hub/blob/content-type"\n`,
      replace: "",
    },
    {
      path: "server/api/events/[slug]/cover.put.ts",
      find: `import { COVER_MAX_BYTES, COVER_MAX_MB, COVER_TYPES } from "#shared/utils/cover"`,
      replace: `import { COVER_MAX_BYTES, COVER_MAX_MB } from "#shared/utils/cover"`,
    },
    {
      path: "server/api/events/[slug]/cover.put.ts",
      find: `  ensureBlob(file, { maxSize: \`\${COVER_MAX_MB}MB\`, types: [...COVER_TYPES] })
  const type = detectContentType(new Uint8Array(await file.slice(0, 64).arrayBuffer()))
  if (type !== file.type) throw createError({ status: 400, statusText: "That file isn't a JPEG, PNG or WebP photo." })

  const [putError, stored] = await blob.put(\`covers/\${found.id}/cover\`, file, { contentType: type, addRandomSuffix: true })`,
      replace: `  ensureBlob(file, { maxSize: \`\${COVER_MAX_MB}MB\`, types: ["image"] })

  const [putError, stored] = await blob.put(\`covers/\${found.id}/cover\`, file, { contentType: file.type, addRandomSuffix: true })`,
    },
  ],
  scripted: {
    checks: ["F1", "C2"],
    async run({ origin, log }) {
      const organizer = await new Visitor(origin).signUp("organizer")
      const script = await upload(organizer, { name: "cover.svg", type: "image/svg+xml", data: svg })
      const page = await upload(organizer, { name: "cover.png", type: "image/png", data: html })
      const photo = await upload(organizer, { name: "cover.png", type: "image/png", data: tinyPng })
      const [svgResult, htmlResult] = [harmless(script), harmless(page)]
      log(`SVG with a script: ${svgResult.said}; HTML named cover.png: ${htmlResult.said}`)
      const photoType = String(photo.served?.headers["content-type"] ?? "none")
      const photoServed = photo.reply.status < 300 && photo.served?.status === 200 && photoType.startsWith("image/")
      const photoSaid = `A 1×1 PNG: upload answered ${photo.reply.status}${photo.served ? `, served ${photo.served.status} as ${photoType}` : photo.reply.status < 300 ? "" : `: ${photo.reply.text.slice(0, 120)}`}.`
      // An app that refuses every upload refuses the attacks too: the refusals only count when a real photo gets in.
      return {
        F1: (svgResult.ok && htmlResult.ok && photoServed ? pass : fail)(`An SVG with a <script> declared image/svg+xml: ${svgResult.said}. An HTML page declared image/png named cover.png: ${htmlResult.said}. ${photoSaid}`),
        C2: (photoServed ? pass : fail)(photoSaid),
      }
    },
  },
})
