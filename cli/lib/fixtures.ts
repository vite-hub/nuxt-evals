// Starting apps. A project's starting files are tasks/<id>/fixture, a shared folder its task names, or nothing.
import { access } from "node:fs/promises"
import { dirname, join } from "node:path"
import { tasks } from "./grade.ts"
import { tasksRoot } from "./paths.ts"

const exists = (path: string) => access(path).then(() => true, () => false)

/** The project's starting app, or undefined when the agent starts in an empty folder. */
export async function fixtureFolder(taskId: string): Promise<string | undefined> {
  const folder = join(tasksRoot, tasks[taskId]?.fixture ?? join(taskId, "fixture"))
  return await exists(folder) ? folder : undefined
}

/** The reference app the judge grades as the yardstick. */
export async function referenceFolder(taskId: string): Promise<string> {
  return join(tasksRoot, taskId, "reference")
}

/** The design pass's anchors, tasks/<id>/VIBE.md, or undefined when the project has none. */
export async function vibeFile(taskId: string): Promise<string | undefined> {
  const file = join(tasksRoot, taskId, "VIBE.md")
  return await exists(file) ? file : undefined
}

/** Projects that share a fixture share one dependency install. */
export function dependencyKey(taskId: string): string {
  const fixture = tasks[taskId]?.fixture
  return fixture ? dirname(fixture).replaceAll("/", "-") : taskId
}
