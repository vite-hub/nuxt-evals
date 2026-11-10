// Preview snapshots: the app's node_modules, installed here the way npm installs in a WebContainer (wasm builds, no
// native binaries), so the site's Preview mounts them instead of running `npm install` in the reader's tab. An install
// there can't resolve these apps from a deployed origin ("Failed to pre-resolve dependencies"), and it takes minutes.
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { createNodeModulesSnapshot, packSnapshot } from "@vite-hub/web-container/snapshot"
import type { RunFile } from "../../site/shared/report.ts"

export interface PreviewSnapshot {
  /** SHA-256 of the joined parts, in hex. The Preview rejects a snapshot that differs. */
  sha256: string
  parts: Buffer[]
}

/** package.json without the pnpm-only fields and the postinstall, which wedges later spawns in a WebContainer. */
export function previewPackageJson(text: string): string {
  const manifest = JSON.parse(text) as { packageManager?: string, scripts?: Record<string, string> }
  delete manifest.packageManager
  delete manifest.scripts?.postinstall
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** The files the Preview mounts beside the snapshot: npm's view of the app. */
export function previewFiles(files: RunFile[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const file of files) {
    if (file.path === "pnpm-lock.yaml" || /(?:^|\/)(?:\.git|\.vitehub|\.env(?:\..*)?)(?:\/|$)/.test(file.path)) continue
    result[file.path] = file.path === "package.json" ? previewPackageJson(file.content) : file.content
  }
  // pnpm warns about peer conflicts that npm stops on (better-auth and @better-auth/passkey pin two patches of better-call).
  result[".npmrc"] = `${result[".npmrc"] ?? ""}\nlegacy-peer-deps=true\n`
  return result
}

/** Installs the app with npm as a WebContainer would and packs node_modules into gzip parts of at most 20 MiB. */
export async function buildPreviewSnapshot(files: RunFile[]): Promise<PreviewSnapshot> {
  const dir = await mkdtemp(join(tmpdir(), "preview-"))
  try {
    for (const [path, content] of Object.entries(previewFiles(files))) {
      await mkdir(dirname(join(dir, path)), { recursive: true })
      await writeFile(join(dir, path), content)
    }
    const { snapshot } = await createNodeModulesSnapshot({ dir })
    const parts = packSnapshot(snapshot).map(part => Buffer.from(part))
    return { sha256: createHash("sha256").update(Buffer.concat(parts)).digest("hex"), parts }
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
}
