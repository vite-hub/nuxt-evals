<script setup lang="ts">
import { useFileDialog, useTitle } from "@vueuse/core"
import { computed } from "vue"
import { useRouter } from "vue-router"
import UnitToggle from "../components/UnitToggle.vue"
import { useSettings } from "../composables/settings"
import { useUserData } from "../composables/user-data"
import { type ColorMode, type Language, languages } from "../domain/types"
import { useI18n } from "../i18n"

const { t, language } = useI18n()
useTitle(computed(() => t.value.app.title(t.value.settings.title)))
const { colorMode, language: chosen } = useSettings()
const { exportData, importData } = useUserData()
const router = useRouter()
const modes: ColorMode[] = ["auto", "light", "dark"]
const languageNames: Record<Language, string> = { en: "English", es: "Español" }

/** The language is in the URL: switching moves to this page in the other language, and remembers the choice. */
function setLanguage(lang: Language) {
  chosen.value = lang
  void router.push({ name: "settings", params: { lang } })
}

const { open, onChange, reset } = useFileDialog({ accept: "application/json,.json", multiple: false })
onChange(async (files) => {
  const file = files?.[0]
  if (file) await importData(file)
  reset()
})
</script>

<template>
  <div class="page settings">
    <h1 tabindex="-1">
      {{ t.settings.title }}
    </h1>
    <section aria-labelledby="display-title" class="card section">
      <h2 id="display-title">
        {{ t.settings.display }}
      </h2>
      <UnitToggle />
      <fieldset class="modes">
        <legend class="legend">{{ t.settings.colorMode }}</legend>
        <label v-for="mode in modes" :key="mode" class="mode">
          <input v-model="colorMode" type="radio" name="color-mode" :value="mode">
          {{ t.settings.modes[mode] }}
        </label>
      </fieldset>
      <fieldset class="modes">
        <legend class="legend">{{ t.settings.language }}</legend>
        <label v-for="lang in languages" :key="lang" class="mode" :lang="lang">
          <input type="radio" name="language" :value="lang" :checked="language === lang" @change="setLanguage(lang)">
          {{ languageNames[lang] }}
        </label>
      </fieldset>
    </section>
    <section aria-labelledby="data-title" class="card section">
      <h2 id="data-title">
        {{ t.settings.data }}
      </h2>
      <p class="muted">
        {{ t.settings.dataIntro }}
      </p>
      <div class="toolbar">
        <button type="button" class="button primary" @click="exportData">
          {{ t.settings.export }}
        </button>
        <button type="button" class="button" @click="open()">
          {{ t.settings.import }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  max-width: 44rem;
}

.section {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.25rem;
}

.section h2 {
  margin: 0;
  font-size: 1.15rem;
}

.section p {
  margin: 0;
}

.modes {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.mode {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
