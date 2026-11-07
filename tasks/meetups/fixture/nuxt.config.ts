export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@nuxt/ui", "@vueuse/nuxt"],
  css: ["~/assets/css/main.css"],
  devtools: { enabled: false },
  ui: { fonts: false },
  runtimeConfig: {
    mailer: { url: "" },
  },
})
