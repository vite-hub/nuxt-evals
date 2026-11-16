import viteHubNuxt from "vite-hub/nuxt"

export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@nuxt/ui", viteHubNuxt],
  css: ["~/assets/css/main.css"],
  devtools: { enabled: false },
  ui: { fonts: false },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      titleTemplate: "%s · Acme Console",
    },
  },
  vitehub: { preset: "node" },
})
