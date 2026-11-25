import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"
import { recipeData } from "./build/recipe-data.ts"
import { serviceWorker } from "./build/service-worker.ts"

export default defineConfig({
  plugins: [vue(), recipeData(), serviceWorker()],
  test: {
    environment: "happy-dom",
    // Week math must hold in a time zone with daylight saving time, whatever the machine's zone is.
    env: { TZ: "Europe/Berlin" },
  },
})
