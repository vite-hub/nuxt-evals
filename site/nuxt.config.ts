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
  // Hosted Comments: the Console stores the threads and signs reviewers in. Open any page with `?vitehub` and choose
  // Comments. The ID is the app's link in console.vitehub.dev.
  app: {
    head: {
      script: [
        {
          type: "module",
          src: "https://console.vitehub.dev/hosted-comments.js",
          "data-vitehub-comments": "6de116e2-a41a-4261-a712-37380c7b34ac",
        },
      ],
    },
  },
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
    // /sitemap.xml lists pages, published runs and projects; /robots.txt names it.
    seo: { sitemap: { exclude: ["/sign-in"] } },
    database: true,
    blob: true,
    // server/agents/coding-agent.ts (`driver: "external"`) runs outside the app. `POST /api/runs` imports its sessions into this
    // one journal (`importAgentSession` from `vite-hub/agent/sessions`), so the Console shows them. One app-wide
    // journal: the Console reads a single journal for every Agent Definition.
    agent: { invocations: { store: "database", content: "content" } },
    workflow: false,
    // Maxi signs in at /sign-in (server/auth.ts: one account, with a passkey) for Content.
    auth: true,
    // The Console is console.vitehub.dev. It signs each call with the key of its link; the public key is the Worker
    // secret VITEHUB_CONSOLE_KEY_CONSOLE_<id>. Visitors read runs through the site's own API.
    console: true,
    // Comments live in the Console (Hosted Comments, the script in app.head), not in this app's database.
    comments: false,
  },
  $development: {
    vitehub: { console: { auth: false } },
  },
})
