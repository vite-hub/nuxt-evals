import viteHubNuxt from "vite-hub/nuxt"
import { env } from "vite-hub/env"

export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@nuxt/ui", "@vueuse/nuxt", viteHubNuxt],
  css: ["~/assets/css/main.css"],

  // In the config, not app.vue, so the error page gets them too.
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      titleTemplate: "%s · Meetups",
      meta: [{ name: "description", content: "Find tech meetups near you, see who's going and grab a seat." }],
    },
  },

  // Override each with NUXT_<PATH> at runtime, for example NUXT_RATES_API_KEY.
  runtimeConfig: {
    rates: {
      url: "https://api.frankfurter.dev/v1/latest",
      apiKey: "",
    },
    mail: {
      from: "Meetups <hello@meetups.example>",
    },
    public: {
      // The public origin, such as https://meetups.example. Set it in production, and always behind an HTTPS
      // proxy. Empty means "the origin of the request", which suits local dev on any port.
      siteUrl: "",
    },
  },

  vitehub: {
    preset: "node",
    // DATABASE_URL picks the database at runtime and for `pnpm db:migrate`: a SQLite file or a libSQL/Turso URL.
    database: {
      connection: {
        url: env({ source: env.source("DATABASE_URL"), default: "file:.vitehub/data/database/sqlite.db" }),
        authToken: env({ secret: true, optional: true, source: env.source("DATABASE_AUTH_TOKEN") }),
      },
    },
    auth: true,
    rateLimit: true,
    // In dev, mail stays in ViteHub's outbox and makes no provider request; builds send through Resend.
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
})
