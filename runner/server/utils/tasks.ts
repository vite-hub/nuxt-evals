import contactEndpoint from "../../../tasks/contact-endpoint/task"
import type { Task } from "../../../tasks/types"

export const tasks: Record<string, Task> = {
  [contactEndpoint.id]: contactEndpoint,
}
