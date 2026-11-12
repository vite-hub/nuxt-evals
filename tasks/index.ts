import contactEndpoint from "./contact-endpoint/task.ts"
import mealPlanner from "./meal-planner/task.ts"
import meetups from "./meetups/task.ts"
import type { Task } from "./types.ts"

/** Every project, by id. */
export const tasks: Record<string, Task<unknown>> = {
  [contactEndpoint.id]: contactEndpoint,
  [meetups.id]: meetups,
  [mealPlanner.id]: mealPlanner,
}
