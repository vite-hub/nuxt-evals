import viteHubNuxt from "vite-hub/nuxt"
import { env } from "vite-hub/env"

export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@nuxt/ui", "@vueuse/nuxt", viteHubNuxt],
  css: ["~/assets/css/main.css"],

  app: {
    head: {
      htmlAttrs: { lang: "en" },
      titleTemplate: "%s · Meetups",
      meta: [{ name: "description", content: "Find tech meetups near you, see who's going and grab a seat." }],
    },
  },

  runtimeConfig: {
    rates: {
      url: "https://api.frankfurter.dev/v1/latest",
      apiKey: "",
    },
    mail: {
      from: "Meetups <hello@meetups.example>",
    },
    trustProxy: false,
    public: {
      siteUrl: "",
    },
  },

  vitehub: {
    preset: "node",
    database: {
      connection: {
        url: env({ source: env.source("DATABASE_URL"), default: "file:.vitehub/data/database/sqlite.db" }),
        authToken: env({ secret: true, optional: true, source: env.source("DATABASE_AUTH_TOKEN") }),
      },
    },
    auth: true,
    rateLimit: true,
    email: {
      driver: "resend",
      options: {
        apiKey: env({ secret: true, source: env.source("RESEND_API_KEY") }),
      },
    },
    queue: true,
    schedule: { runtime: { driver: "process" } },
    kv: true,
    blob: {
      serve: {
        route: "/images",
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      },
    },
    cache: true,
  },

  $production: {
    routeRules: {
      "/**": {
        headers: {
          "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        },
      },
    },
  },

  nitro: {
    experimental: { tasks: true },
  },
})
