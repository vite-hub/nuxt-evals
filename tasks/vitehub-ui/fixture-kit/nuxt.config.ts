export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@vite-hub/kit/nuxt"],
  css: ["~/assets/css/main.css"],
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      titleTemplate: "%s · Acme Console",
    },
  },
})
