// Prints C4's tables and verdict from stored runs. No model call.
//   node tasks/vitehub-ui/layouts/c4-summary.ts <main results dir> [<holdout results dir>]
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { c4Verdict } from "./c4-targets.ts"
import type { CallRecord } from "./run.ts"
import { formats, type Format } from "./score.ts"

async function load(dir: string | undefined): Promise<CallRecord[]> {
  if (!dir) return []
  const names = (await readdir(dir)).filter(name => name.endsWith(".json") && name !== "summary.json")
  return Promise.all(names.map(async name => JSON.parse(await readFile(join(dir, name), "utf8")) as CallRecord))
}

const count = (records: CallRecord[], test: (record: CallRecord) => boolean) => records.filter(test).length
const cost = (records: CallRecord[]) => records.reduce((sum, record) => sum + Number(record.usage.costUsd ?? 0), 0)
const passes = (records: CallRecord[]) => Object.fromEntries(formats.map(format => [format, count(records, record => record.format === format && record.pass)])) as Record<Format, number>

function table(title: string, records: CallRecord[]) {
  console.log(`## ${title}\n`)
  console.log("| Format | Model | Valid | First-try pass | Call errors | Cost |\n| --- | --- | --- | --- | --- | --- |")
  for (const format of formats) {
    for (const model of ["opus", "sol", "both"] as const) {
      const group = records.filter(record => record.format === format && (model === "both" || record.model === model))
      console.log(`| ${format} | ${model} | ${count(group, record => record.valid)}/${group.length} | ${count(group, record => record.pass)}/${group.length} | ${count(group, record => Boolean(record.error))} | $${cost(group).toFixed(2)} |`)
    }
  }
  console.log("\n| Task | json-render opus | json-render sol | a2ui opus | a2ui sol |\n| --- | --- | --- | --- | --- |")
  for (const task of [...new Set(records.map(record => record.task))].sort()) {
    const cell = (format: Format, model: string) => {
      const group = records.filter(record => record.task === task && record.format === format && record.model === model)
      return `${count(group, record => record.pass)}/${group.length}`
    }
    console.log(`| ${task} | ${cell("json-render", "opus")} | ${cell("json-render", "sol")} | ${cell("a2ui", "opus")} | ${cell("a2ui", "sol")} |`)
  }
  console.log("\nMisses:\n")
  for (const record of records.filter(entry => !entry.pass).sort((a, b) => `${a.format}${a.task}${a.model}${a.repeat}`.localeCompare(`${b.format}${b.task}${b.model}${b.repeat}`))) {
    const why = record.error ? `call error: ${record.error.slice(0, 100)}` : !record.valid ? `invalid: ${record.errors[0]?.slice(0, 140)}` : `rubric: ${record.checks.filter(check => !check.pass).map(check => check.id).join(", ")}`
    console.log(`- ${record.format} ${record.task} ${record.model} #${record.repeat}: ${why}`)
  }
  console.log("")
}

const [mainDir, holdoutDir] = process.argv.slice(2)
if (!mainDir) throw new Error("Name the main results folder, and the holdout folder when it has run.")
const main = await load(mainDir)
const holdout = await load(holdoutDir)
table("Main set", main)
if (holdout.length) table("Holdout set", holdout)
const mainPasses = passes(main)
const holdoutPasses = passes(holdout)
console.log(`Main set first-try passes: json-render ${mainPasses["json-render"]}, A2UI ${mainPasses.a2ui}.`)
if (holdout.length) {
  console.log(`Holdout first-try passes: json-render ${holdoutPasses["json-render"]}, A2UI ${holdoutPasses.a2ui}.`)
  const verdict = c4Verdict(mainPasses, holdoutPasses)
  console.log(`Verdict: ${verdict.winner} (${verdict.reason}).`)
}
else console.log("Verdict waits for the holdout set.")
console.log(`Cost: $${cost([...main, ...holdout]).toFixed(2)} at models.dev list prices.`)
