import { defineConfig } from "vite"
import { vitehub } from "vite-hub"

export default defineConfig({
  // Server code imports the task folders and the shared report type from the repo root.
  server: { fs: { allow: [".."] } },
  plugins: [vitehub({
    name: "nuxt-evals-runner",
    preset: "node",
    agent: true,
    // The Agent runs inside the request, so no Workflow is needed yet.
    workflow: false,
    // Local Console at http://127.0.0.1:4792/_vitehub shows each Agent session.
    console: { auth: false },
  })],
})
