import type { Task } from "../types.ts"
import { probes } from "../ui-dialog-form/task.ts"
import { startApp, type UiRuntime } from "../vitehub-ui/harness.ts"

const id = "ui-dialog-form-uisdk"
const fixture = "vitehub-ui/fixture-uisdk"

/** `ui-dialog-form` with the same prompt and probes, on ui-sdk instead of Nuxt UI and ViteHub UI. */
const task: Task<UiRuntime> = {
  id,
  title: "ui-sdk: New project dialog",
  fixture,
  skills: ["node_modules/@ui-sdk/core/skills/ui-sdk"],
  target: 1,
  timeLimitMinutes: 30,
  probes,
  start: work => startApp(work, id),
}

export default task
