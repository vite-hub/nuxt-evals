import { fileURLToPath } from "node:url"
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
    // Read-only and open: anyone can read runs, nobody can change them through the Console.
    // vite-hub 0.1.0 resolves a relative authorize path from Nuxt's app/ dir, so pass an absolute one.
    console: { auth: false, authorize: fileURLToPath(new URL("./server/console-authorize.ts", import.meta.url)) },
  },
  nitro: {
    cloudflare: {
      wrangler: {
        routes: [{ pattern: "nuxt-evals.onmax.me", custom_domain: true }],
      },
    },
  },
})
