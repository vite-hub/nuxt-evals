import { c4Holdout, c4Tasks } from "./c4-targets.ts"
import { tasks, type LayoutTask } from "./tasks.ts"

/** The task sets: N1's four tasks, C4's main set and C4's holdout set (`c4-targets.ts`). */
export const taskSets = { "n1": tasks, "c4": c4Tasks, "c4-holdout": c4Holdout } as const satisfies Record<string, LayoutTask[]>
export type TaskSet = keyof typeof taskSets

const allTasks: LayoutTask[] = Object.values(taskSets).flat()

export function findTask(id: string): LayoutTask {
  const task = allTasks.find(entry => entry.id === id)
  if (!task) throw new Error(`Unknown task ${id}. Known: ${allTasks.map(entry => entry.id).join(", ")}.`)
  return task
}
