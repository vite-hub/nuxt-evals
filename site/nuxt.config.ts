import { defineNuxtConfig } from "nuxt/config"
import viteHubNuxt from "vite-hub/nuxt"

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
  vitehub: {
    name: "nuxt-evals",
    preset: "cloudflare",
    database: true,
    blob: true,
    // Runs replay into server/agents/codex-a.ts, so each one is an Agent session in this app's journal.
    agent: true,
    workflow: false,
    // Visitors see the Agent sessions read-only. Maxi signs in at /sign-in (a Cloudflare Access app) and sees every
    // section, the Content editor included. `guest` and the Access cookie are pnpm patches (patches/README.md).
    console: {
      auth: { provider: "cloudflare-access" },
      guest: { sections: ["agents:read"] },
    },
  },
  nitro: {
    cloudflare: {
      wrangler: {
        routes: [{ pattern: "nuxt-evals.onmax.me", custom_domain: true }],
        // Cloudflare Access app "Nuxt evals sign-in" on nuxt-evals.onmax.me/sign-in (not secret).
        vars: {
          CF_ACCESS_TEAM_DOMAIN: "onmax.cloudflareaccess.com",
          CF_ACCESS_AUD: "74a8561bff14f79dcba8d402f39f21d95ed28c904c99e11edf3128595a1170f2",
        },
      },
    },
  },
})
