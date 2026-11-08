import viteHubNuxt from "vite-hub/nuxt"
import { env } from "vite-hub/env"

export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@nuxt/ui", "@vueuse/nuxt", viteHubNuxt],
  css: ["~/assets/css/main.css"],

  // Override each with NUXT_<PATH> at runtime, for example NUXT_RATES_API_KEY.
  runtimeConfig: {
    rates: {
      url: "https://api.frankfurter.dev/v1/latest",
      apiKey: "",
    },
    mail: {
      from: "Meetups <hello@meetups.example>",
    },
  },

  vitehub: {
    preset: "node",
    database: true,
    auth: true,
    rateLimit: true,
    email: {
      driver: "resend",
      options: {
        apiKey: env({ secret: true, source: env.source("RESEND_API_KEY") }),
      },
    },
  },

  nitro: {
    // server/tasks/db/seed.ts fills a fresh database with demo data.
    experimental: { tasks: true },
  },

  $development: {
    // Keep mail in the dev outbox (Console > Email) instead of sending it.
    vitehub: { email: { deliver: false } },
  },
})
