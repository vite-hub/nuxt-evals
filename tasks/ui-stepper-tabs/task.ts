import type { Task } from "../types.ts"
import { startApp, type UiRuntime } from "../vitehub-ui/harness.ts"
import { probes } from "../vitehub-ui/stepper-probes.ts"

const id = "ui-stepper-tabs"
const fixture = "vitehub-ui/fixture-uisdk"

/** The checkout stepper on ui-sdk alone, which has no stepper: tabs with a guard, or parts of your own. Same prompt and probes as ui-stepper-kit. */
const task: Task<UiRuntime> = {
  id,
  title: "ui-sdk: checkout stepper",
  fixture,
  skills: ["node_modules/@ui-sdk/core/skills/ui-sdk"],
  target: 0.9,
  timeLimitMinutes: 30,
  probes,
  start: work => startApp(work, id),
}

export default task
