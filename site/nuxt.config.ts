import { defineNuxtConfig } from "nuxt/config"
import viteHubNuxt from "vite-hub/nuxt"
import { webContainerHeaders } from "@vite-hub/web-container/vite"

export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@nuxt/ui", viteHubNuxt],
  css: ["~/assets/css/main.css"],
  // Set NUXT_INGEST_TOKEN as a Worker secret. The runner sends it to post results.
  runtimeConfig: { ingestToken: "" },
  // Same faces as onmax.me. @nuxt/ui brings @nuxt/fonts and @nuxt/icon.
  fonts: {
    families: [
      { name: "Geist", weights: [400, 500, 600], global: true },
      { name: "Geist Mono", weights: [400, 500], global: true },
    ],
  },
  icon: { serverBundle: "local" },
  // The Preview surface boots a WebContainer, which needs a cross-origin isolated page. Every page sends the headers:
  // a client-side link from the results page keeps that page's document, so a run page alone isn't enough.
  routeRules: {
    "/**": { headers: webContainerHeaders },
  },
  vitehub: {
    name: "nuxt-evals",
    host: "cloudflare",
    // Serves the Worker on this custom domain (a wrangler `custom_domain` route).
    publicUrl: "https://nuxt-evals.onmax.me",
    database: true,
    blob: true,
    // server/agents/codex.ts and claude-code.ts run outside the app. `POST /api/runs` imports their sessions into this
    // one journal (`importAgentSession` from `vite-hub/agent/sessions`), so the Console shows them. One app-wide
    // journal: the Console reads a single journal for every Agent Definition.
    agent: { invocations: { store: "database", content: "content" } },
    workflow: false,
    // Maxi signs in at /sign-in (server/auth.ts: one account, with a passkey) for Comments and Content.
    auth: true,
    // The Console is console.vitehub.dev. It signs each call with the key of its link; the public key is the Worker
    // secret VITEHUB_CONSOLE_KEY_CONSOLE_<id>. Visitors read runs through the site's own API.
    console: true,
    // Pinned comments on any page (`?vitehub=comments`, or C after signing in). server/comments.ts lets only the signed-in
    // account read and write them; visitors see none.
    comments: true,
  },
  $development: {
    vitehub: { console: { auth: false } },
  },
})
