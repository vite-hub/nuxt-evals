// Writes sw.js for each build from build/sw.js: the version is a hash of every file the app needs offline, so a build
// with any change is a new version, and one without is the same.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Plugin } from "vite"

export function serviceWorker(): Plugin {
  return {
    name: "service-worker",
    apply: "build",
    // After Vite's own plugins, so the bundle already holds index.html.
    enforce: "post",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).sort()
      const shards = files.filter(file => /^data\/recipes-/.test(file))
      const precache = [...files.filter(file => !shards.includes(file) && !file.endsWith(".map")), "favicon.svg"]
      const template = readFileSync(join(import.meta.dirname, "sw.js"), "utf8")
      // The worker's own code counts too: a change to it alone is a new version.
      const hash = createHash("sha256").update(template)
      for (const file of precache) {
        const output = bundle[file]
        hash.update(file).update(output?.type === "asset" ? String(output.source) : "")
      }
      const manifest = { version: hash.digest("hex").slice(0, 12), precache, shards }
      this.emitFile({ type: "asset", fileName: "sw.js", source: `self.__MANIFEST = ${JSON.stringify(manifest)}\n${template}` })
    },
  }
}
