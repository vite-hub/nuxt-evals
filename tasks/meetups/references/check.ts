// Grades the reference and the tempting-wrong solutions, each several times, and prints a stability table.
//   node tasks/meetups/references/check.ts [--runs 3] [reference wrong-fetch ...]
// A solution is a folder of files laid over the fixture. `wrong-*` folders are laid over `reference` first, so each one
// changes only the parts it gets wrong. A `DELETE` file in a layer lists files to remove.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, relative } from "node:path"
import { parseArgs } from "node:util"
import { gradeProbes } from "../../../cli/lib/grade.ts"
import task from "../task.ts"

const here = import.meta.dirname
const fixture = join(here, "../fixture")
const { values, positionals } = parseArgs({ allowPositionals: true, options: { runs: { type: "string", default: "3" } } })
const solutions = positionals.length ? positionals : (await readdir(here, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort((a, b) => a === "reference" ? -1 : b === "reference" ? 1 : a.localeCompare(b))

async function walk(directory: string, root = directory): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (entry.name === "node_modules") continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...await walk(path, root))
    else found.push(relative(root, path))
  }
  return found
}

async function workingCopy(solution: string): Promise<{ work: string, files: { path: string, content: string }[], diff: string }> {
  const work = join(homedir(), ".cache/nuxt-evals/work", `meetups-${solution}`)
  await rm(work, { recursive: true, force: true })
  await mkdir(work, { recursive: true })
  await cp(fixture, work, { recursive: true, filter: source => !source.includes("node_modules") })
  const layers = solution === "reference" ? ["reference"] : ["reference", solution]
  for (const layer of layers) {
    await cp(join(here, layer), work, { recursive: true, filter: source => source !== join(here, layer, "DELETE") })
    // A layer's DELETE file lists fixture or reference files that the solution doesn't have.
    const deleted = (await readFile(join(here, layer, "DELETE"), "utf8").catch(() => "")).split("\n").filter(Boolean)
    for (const path of deleted) await rm(join(work, path), { force: true })
  }
  const files = await Promise.all((await walk(work)).sort().map(async path => ({ path, content: await readFile(join(work, path), "utf8") })))
  const changed: string[] = []
  for (const file of files) {
    const original = await readFile(join(fixture, file.path), "utf8").catch(() => undefined)
    if (original !== file.content) changed.push(file.path)
  }
  // gradeProbes only reads the `+++ b/<path>` lines of the diff.
  return { work, files, diff: changed.map(path => `+++ b/${path}`).join("\n") }
}

const table: Record<string, Record<string, string[]>> = {}
const timings: Record<string, string[]> = {}
for (const solution of solutions) {
  const { work, files, diff } = await workingCopy(solution)
  table[solution] = {}
  timings[solution] = []
  for (let run = 1; run <= Number(values.runs); run++) {
    const started = performance.now()
    const lines: string[] = []
    const results = await gradeProbes(task, files, diff, work, line => lines.push(line))
    const total = Math.round((performance.now() - started) / 1000)
    timings[solution].push(`${total}s (${lines[0]})`)
    for (const result of results) (table[solution][result.id] ??= []).push(result.passed ? "pass" : "FAIL")
    console.log(`\n## ${solution} run ${run}: ${results.filter(result => result.passed).length}/${results.length} in ${total}s`)
    for (const line of lines) console.log(`  ${line}`)
  }
}

const ids = task.probes.map(probe => probe.id)
const header = `| probe | ${solutions.join(" | ")} |\n| --- | ${solutions.map(() => "---").join(" | ")} |`
const rows = ids.map(id => `| ${id} | ${solutions.map((solution) => {
  const runs = table[solution]![id] ?? []
  const same = runs.every(value => value === runs[0])
  return same ? `${runs[0]} ×${runs.length}` : `**unstable** ${runs.join("/")}`
}).join(" | ")} |`)
const markdown = `${header}\n${rows.join("\n")}\n\nTimes per run:\n${solutions.map(solution => `- ${solution}: ${timings[solution]!.join("; ")}`).join("\n")}\n`
console.log(`\n${markdown}`)
await writeFile(join(homedir(), ".cache/nuxt-evals/meetups-check.md"), markdown)
