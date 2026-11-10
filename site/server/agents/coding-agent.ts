import { defineAgent } from "vite-hub/agent"
import { externalAgentDriver } from "../utils/external-agent"

/**
 * The coding agent under evaluation. It runs through the nuxt-evals CLI on a laptop or runner, never in this app, with
 * Codex or Claude Code as its harness. `POST /api/runs` imports each session; the harness, model and setup are fields
 * of the session. Its files are in the project's Workspace, on the ref of the run.
 */
export default defineAgent({
  description: "Codex or Claude Code, building Nuxt projects from a product spec.",
  runtime: false,
  workspace: "meetups-v2",
  driver: externalAgentDriver("The coding agent"),
})
