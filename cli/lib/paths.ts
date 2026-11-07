import { join, resolve } from "node:path"

export const cliRoot = resolve(import.meta.dirname, "..")
export const repoRoot = resolve(cliRoot, "..")
export const tasksRoot = join(repoRoot, "tasks")
/** Every finished run: run.json, session.jsonl, diff.patch, files.json, summary.md. */
export const runsRoot = join(cliRoot, ".data/runs")

export function runFolder(id: string): string {
  if (!/^[\w.-]+$/.test(id)) throw new Error(`Bad run id: ${id}`)
  return join(runsRoot, id)
}
