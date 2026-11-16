// Moves the ui-sdk tasks to another ui-sdk version, then grades their hand-written solutions. No agent runs, so it needs
// no CLIProxy key. Run it when ui-sdk ships a version, then run the agents (the README says how).
//   node tasks/vitehub-ui/bump-ui-sdk.ts <version> [--kit <vite-hub/vitehub commit>] [--no-check]
// `--kit` also moves fixture-kit to the pkg.pr.new build of @vite-hub/kit at that commit.
import { spawnSync } from "node:child_process"
import { readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { runHeavy } from "../../cli/lib/prepare.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: { "kit": { type: "string" }, "no-check": { type: "boolean", default: false } } })
const [version] = positionals
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/.test(version)) throw new Error("Name an exact ui-sdk version, such as 0.1.0-beta.3.")
if (values.kit && !/^[0-9a-f]{7,40}$/.test(values.kit)) throw new Error("--kit takes a vite-hub/vitehub commit SHA.")

const here = import.meta.dirname
const apps = ["fixture-uisdk", "fixture-kit", "operate/app"]
const current = JSON.parse(await readFile(join(here, "fixture-uisdk/package.json"), "utf8")).dependencies["@ui-sdk/vue"] as string
const escaped = current.replaceAll(".", "\\.")

for (const app of apps) {
  const folder = join(here, app)
  const manifest = join(folder, "package.json")
  let text = (await readFile(manifest, "utf8")).replace(new RegExp(`("@ui-sdk/(?:core|vue)": )"${escaped}"`, "g"), `$1"${version}"`)
  if (values.kit && app === "fixture-kit") text = text.replace(/(pkg\.pr\.new\/vite-hub\/vitehub\/@vite-hub\/kit@)[0-9a-f]+/, `$1${values.kit}`)
  await writeFile(manifest, text)
  // ui-sdk is newer than pnpm's minimum release age for a day after each release.
  const workspace = join(folder, "pnpm-workspace.yaml")
  await writeFile(workspace, (await readFile(workspace, "utf8")).replace(new RegExp(`(@ui-sdk/(?:core|vue)@)${escaped}`, "g"), `$1${version}`))
  await runHeavy(["pnpm", "install", "--lockfile-only"], { cwd: folder, timeoutMs: 600_000 })
  console.log(`${app}: @ui-sdk/core and @ui-sdk/vue ${current} -> ${version}${values.kit && app === "fixture-kit" ? `, @vite-hub/kit ${values.kit}` : ""}`)
}
// The operate eval serves this build and builds it only when it is missing.
await rm(join(here, "operate/app/dist"), { recursive: true, force: true })

// git grep exits with 1 when nothing matches.
const stale = spawnSync("git", ["grep", "-l", "-F", current, "--", "."], { cwd: here, encoding: "utf8" }).stdout.split("\n").filter(path => path && !path.endsWith("pnpm-lock.yaml"))
if (stale.length) console.log(`\nThese files still name ${current} in their text. Update what is about the pinned version:\n${stale.map(path => `  tasks/vitehub-ui/${path}`).join("\n")}`)

if (!values["no-check"]) {
  let failed = false
  for (const task of ["ui-dialog-form-uisdk", "ui-stepper-tabs", "ui-stepper-kit"]) {
    console.log(`\n# ${task}`)
    failed = spawnSync(process.execPath, [join(here, "references/check.ts"), task], { stdio: "inherit" }).status !== 0 || failed
  }
  if (failed) {
    console.error(`\nA reference misses a probe on ${version}. Read its lines above before you run the agents: the change is in ui-sdk or the kit, not in an agent.`)
    process.exitCode = 1
  }
}
