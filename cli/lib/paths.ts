import { join, resolve } from "node:path"

export const cliRoot = resolve(import.meta.dirname, "..")
export const repoRoot = resolve(cliRoot, "..")
export const tasksRoot = join(repoRoot, "tasks")
/** Every finished run: run.json, session.jsonl, diff.patch, files.json, summary.md. */
export const runsRoot = join(cliRoot, ".data/runs")

/** A task's starting files: `tasks/<fixture>` when it names a shared folder, else `tasks/<id>/fixture`. */
export function fixtureFolder(task: { id: string, fixture?: string }): string {
  return join(tasksRoot, task.fixture ?? join(task.id, "fixture"))
}

export function runFolder(id: string): string {
  if (!/^[\w.-]+$/.test(id)) throw new Error(`Bad run id: ${id}`)
  return join(runsRoot, id)
}
