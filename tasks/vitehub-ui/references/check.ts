// Grades the hand-written solutions of a ViteHub UI task with its probes, and prints a table. No agent runs.
//   node tasks/vitehub-ui/references/check.ts <task> [--runs 1] [reference wrong-hand-rolled ...]
// A solution is a folder of files laid over the shared fixture, in references/<task>/<solution>. The other folders are
// laid over `reference` first, so each one changes only what differs: `wrong-*` is a tempting wrong form, and `trap-*`
// is a right form that today's stack breaks. The reference must pass every probe; the command exits with 1 when it doesn't.
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises"
import { homedir } from "node:os"
import { join, relative } from "node:path"
import { parseArgs } from "node:util"
import { gradeProbes } from "../../../cli/lib/grade.ts"
import { fixtureFolder } from "../../../cli/lib/paths.ts"
import { tasks } from "../../index.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: { runs: { type: "string", default: "1" } } })
const [taskId, ...picked] = positionals
const task = taskId ? tasks[taskId] : undefined
if (!task) throw new Error(`Name a task: ${Object.keys(tasks).filter(id => id.startsWith("ui-")).join(", ")}`)
const here = join(import.meta.dirname, task.id)
const fixture = fixtureFolder(task)
const solutions = picked.length ? picked : (await readdir(here, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort((a, b) => a === "reference" ? -1 : b === "reference" ? 1 : a.localeCompare(b))

async function walk(directory: string, root = directory): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (["node_modules", ".nuxt", ".output"].includes(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...await walk(path, root))
    else found.push(relative(root, path))
  }
  return found
}

async function workingCopy(solution: string): Promise<{ work: string, files: { path: string, content: string }[], diff: string }> {
  const work = join(homedir(), ".cache/nuxt-evals/work", `${task!.id}-${solution}`)
  await rm(work, { recursive: true, force: true })
  await mkdir(work, { recursive: true })
  await cp(fixture, work, { recursive: true, filter: source => !/node_modules|\.nuxt|\.output/.test(source) })
  for (const layer of solution === "reference" ? ["reference"] : ["reference", solution]) await cp(join(here, layer), work, { recursive: true })
  const files = await Promise.all((await walk(work)).sort().map(async path => ({ path, content: await readFile(join(work, path), "utf8") })))
  const changed: string[] = []
  for (const file of files) {
    if (await readFile(join(fixture, file.path), "utf8").catch(() => undefined) !== file.content) changed.push(file.path)
  }
  // gradeProbes only reads the `+++ b/<path>` lines of the diff.
  return { work, files, diff: changed.map(path => `+++ b/${path}`).join("\n") }
}

const table: Record<string, Record<string, string[]>> = {}
for (const solution of solutions) {
  const { work, files, diff } = await workingCopy(solution)
  table[solution] = {}
  for (let run = 1; run <= Number(values.runs); run++) {
    const started = performance.now()
    const lines: string[] = []
    const results = await gradeProbes(task, files, diff, work, line => lines.push(line))
    for (const result of results) (table[solution][result.id] ??= []).push(result.passed ? "pass" : "FAIL")
    const passed = results.filter(result => result.passed).length
    console.log(`\n## ${task.id} ${solution} run ${run}: ${passed}/${results.length} in ${Math.round((performance.now() - started) / 1000)} s`)
    for (const line of lines) console.log(`  ${line}`)
    if (solution === "reference" && passed !== results.length) process.exitCode = 1
  }
}

const header = `| probe | ${solutions.join(" | ")} |\n| --- | ${solutions.map(() => "---").join(" | ")} |`
const rows = task.probes.map(probe => `| ${probe.id} | ${solutions.map((solution) => {
  const runs = table[solution]![probe.id] ?? []
  return runs.every(value => value === runs[0]) ? `${runs[0]} ×${runs.length}` : `**unstable** ${runs.join("/")}`
}).join(" | ")} |`)
console.log(`\n${header}\n${rows.join("\n")}`)
