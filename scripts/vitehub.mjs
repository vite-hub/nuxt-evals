// Point every ViteHub package at one pkg.pr.new build of vite-hub/vitehub (main, or a branch such as preview/nuxt-evals).
// Usage: node scripts/vitehub.mjs <commit sha>   then: pnpm install
// ViteHub changes daily; this keeps site, cli and all transitive @vite-hub/* packages on the same commit.
import { readFileSync, writeFileSync } from "node:fs"

const sha = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("Pass the full 40-character commit sha of a vite-hub/vitehub build.")

const packages = ["vite-hub", ...["agent", "auth", "blob", "browser", "bundle", "channels", "cli", "cms", "codemods", "comments", "connections", "content", "database", "decisions", "docs", "email", "env", "forge", "gateways", "kv", "markdown-template", "presets", "queue", "rate-limit", "realtime", "runtime", "sandbox", "schedule", "shell", "source", "ui", "web-container", "workflow", "workspace", "forms", "i18n", "kit", "mcp"].map(name => `@vite-hub/${name}`)]
const url = name => `https://pkg.pr.new/vite-hub/vitehub/${name}@${sha}`

const workspace = "pnpm-workspace.yaml"
const start = "  # vitehub:start"
const end = "  # vitehub:end"
const block = [start, ...packages.map(name => `  "${name}": ${url(name)}`), end].join("\n")
let text = readFileSync(workspace, "utf8")
text = text.includes(start) ? text.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block) : text.replace("overrides:\n", `overrides:\n${block}\n`)
writeFileSync(workspace, text)

for (const file of ["site/package.json", "cli/package.json"]) {
  const json = JSON.parse(readFileSync(file, "utf8"))
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(json[field] ?? {})) if (packages.includes(name)) json[field][name] = url(name)
  }
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}
console.log(`ViteHub packages now point at ${sha}. Run pnpm install.`)
