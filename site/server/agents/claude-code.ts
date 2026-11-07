import { defineAgent } from "vite-hub/agent"
import { externalAgentDriver } from "../utils/external-agent"

/** Claude Code. It runs through the nuxt-evals CLI on a laptop or runner, never in this app; `POST /api/runs` imports its sessions. */
export default defineAgent({
  runtime: false,
  driver: externalAgentDriver("Claude Code"),
})
