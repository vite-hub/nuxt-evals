// Build patches/@vite-hub__agent@<version>.patch from patches/src/agent-sessions.
// Run after `pnpm install` without the patch applied, or with it: the script diffs against a clean copy of the tarball.
//   node scripts/patch-agent.mjs
import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const installed = JSON.parse(readFileSync(join(root, "site/node_modules/@vite-hub/agent/package.json"), "utf8"))
const version = installed.version
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")
const url = /"@vite-hub\/agent":\s*(\S+)/.exec(workspace)?.[1]?.replace(/^["']|["']$/g, "")
if (!url) throw new Error("No @vite-hub/agent override in pnpm-workspace.yaml.")

const work = mkdtempSync(join(tmpdir(), "nuxt-evals-agent-patch-"))
try {
  // A clean copy of the published tarball, so an applied patch never leaks into the base.
  execFileSync("curl", ["-sfL", url, "-o", join(work, "agent.tgz")])
  execFileSync("tar", ["-xzf", "agent.tgz"], { cwd: work })
  const a = join(work, "a")
  const b = join(work, "b")
  cpSync(join(work, "package"), a, { recursive: true })
  cpSync(join(work, "package"), b, { recursive: true })

  const source = join(root, "patches/src/agent-sessions")
  cpSync(join(source, "sessions.js"), join(b, "dist/sessions.js"))
  cpSync(join(source, "sessions.d.ts"), join(b, "dist/sessions.d.ts"))
  const manifest = readFileSync(join(b, "package.json"), "utf8")
  const entry = `    "./sessions": {\n      "types": "./dist/sessions.d.ts",\n      "import": "./dist/sessions.js",\n      "default": "./dist/sessions.js"\n    },\n    "./eval": {`
  if (!manifest.includes(`    "./eval": {`)) throw new Error("The @vite-hub/agent exports changed. Update scripts/patch-agent.mjs.")
  writeFileSync(join(b, "package.json"), manifest.replace(`    "./eval": {`, entry))

  let diff = ""
  try {
    execFileSync("git", ["diff", "--no-index", "--no-color", "--src-prefix=a/", "--dst-prefix=b/", "a", "b"], { cwd: work, encoding: "utf8" })
  }
  catch (error) {
    diff = error.stdout
  }
  // git names the two trees a/ and b/; strip them so the paths are package-relative.
  diff = diff.replace(/^(diff --git |--- |\+\+\+ )a\/[ab]\//gm, "$1a/").replace(/ b\/[ab]\//g, " b/").replace(/^\+\+\+ b\/[ab]\//gm, "+++ b/")
  const out = join(root, `patches/@vite-hub__agent@${version}.patch`)
  writeFileSync(out, diff)
  console.log(`Wrote ${out} (${diff.split("\n").length} lines)`)
}
finally {
  rmSync(work, { recursive: true, force: true })
}
