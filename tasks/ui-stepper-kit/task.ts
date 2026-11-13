import type { Task } from "../types.ts"
import { startApp, type UiRuntime } from "../vitehub-ui/harness.ts"
import { probes } from "../vitehub-ui/stepper-probes.ts"

const id = "ui-stepper-kit"
const fixture = "vitehub-ui/fixture-kit"

/** The checkout stepper on `@vite-hub/kit`, which adds the stepper that ui-sdk lacks. Same prompt and probes as ui-stepper-tabs. */
const task: Task<UiRuntime> = {
  id,
  title: "ViteHub kit: checkout stepper",
  fixture,
  skills: ["node_modules/@ui-sdk/core/skills/ui-sdk"],
  timeLimitMinutes: 30,
  probes,
  start: work => startApp(work, { id, fixture }),
}

export default task
