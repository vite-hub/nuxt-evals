import { codexDriver, defineAgent } from "vite-hub/agent"
import { cliproxy } from "vite-hub/gateways"
import { runDirectory, runHome } from "../utils/run-directory"

/** Setup A: bare Codex. No MCP servers, no skills, an empty HOME. The invoker id is the run id. */
export default defineAgent({
  runtime: false,
  driver: codexDriver({
    gateway: cliproxy(),
    model: "gpt-6-luna",
    reasoningEffort: "low",
    permissions: "allow-edits-unattended",
    cwd: ({ invoker }) => runDirectory(invoker?.id ?? "missing"),
    env: ({ invoker }) => ({ HOME: runHome(invoker?.id ?? "missing") }),
  }),
})
