import { defineAgent } from "vite-hub/agent"
import { finishRelay, takeRelay } from "../utils/relay"

/**
 * Setup A (bare Codex) as seen from the site. Codex runs in the runner on Slimbook; this Agent replays its events,
 * so each run is an Agent session in this app's journal and public Console. The invoker id is the eval run id.
 */
export default defineAgent({
  runtime: false,
  invocations: { store: "database", content: "content" },
  driver: {
    run: ({ invoker }) => ({ stream: takeRelay(invoker.id) }),
  },
  hooks: {
    "agent:finish"(event) {
      finishRelay(event.invoker.id, event.invocation.run?.runId)
    },
  },
})
