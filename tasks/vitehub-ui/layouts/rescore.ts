// Scores the saved replies of a run again with the current validators and rubric. No model call.
//   node tasks/vitehub-ui/layouts/rescore.ts <results dir>
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { CallRecord } from "./run.ts"
import { score } from "./score.ts"
import { findTask } from "./tasks.ts"

const dir = process.argv[2]
if (!dir) throw new Error("Name a results folder.")
let changed = 0
for (const name of (await readdir(dir)).filter(file => file.endsWith(".json") && file !== "summary.json")) {
  const record = JSON.parse(await readFile(join(dir, name), "utf8")) as CallRecord
  if (record.error) continue
  const result = score(record.format, findTask(record.task), record.reply)
  if (result.pass !== record.pass) {
    changed++
    console.log(`${name}: ${record.pass ? "pass" : "fail"} -> ${result.pass ? "pass" : "fail"}`)
  }
  const next = { ...record, valid: result.valid, errors: result.errors, checks: result.checks, rubricComplete: result.rubricComplete, pass: result.pass }
  await writeFile(join(dir, name), `${JSON.stringify(next, null, 2)}\n`)
}
console.log(`${changed} verdicts changed.`)
