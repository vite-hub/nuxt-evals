import type { Task } from "../types.ts"

/**
 * Meetups v2: the agent starts in an empty folder with the vague PROMPT.md. It has no probes; the Opus judge grades
 * the run against RUBRIC.md (`pnpm evals judge <id>`), and the reference app in `reference/` is the yardstick.
 */
const task: Task = {
  id: "meetups-v2",
  title: "Meetups v2",
  rubric: true,
  probes: [],
}

export default task
