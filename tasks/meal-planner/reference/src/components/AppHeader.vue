<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import { useSettings } from "../composables/settings"
import type { ColorMode } from "../domain/types"
import { useI18n } from "../i18n"

const { t, language } = useI18n()
const route = useRoute()
const { colorMode, language: chosen } = useSettings()
const next: Record<ColorMode, ColorMode> = { auto: "light", light: "dark", dark: "auto" }
const label = computed(() => t.value.app.colorMode(t.value.app.colorModes[colorMode.value], t.value.app.colorModes[next[colorMode.value]]))
const other = computed(() => language.value === "en" ? "es" : "en")
// The same page, filters and all, in the other language.
const otherLanguage = computed(() => route.name ? { name: route.name, params: { ...route.params, lang: other.value }, query: route.query, hash: route.hash } : { path: `/${other.value}` })

const links = computed(() => [
  { name: "recipes", label: t.value.app.nav.recipes },
  { name: "plan", label: t.value.app.nav.plan },
  { name: "shopping", label: t.value.app.nav.shopping },
  { name: "household", label: t.value.app.nav.household },
  { name: "pantry", label: t.value.app.nav.pantry },
  { name: "my-recipes", label: t.value.app.nav.mine },
  { name: "settings", label: t.value.app.nav.settings },
] as const)
</script>

<template>
  <header class="header no-print">
    <RouterLink :to="{ name: 'recipes' }" class="brand">
      <svg aria-hidden="true" viewBox="0 0 32 32" width="28" height="28"><circle cx="16" cy="16" r="15" fill="var(--brand)" /><path d="M10 9v7a3 3 0 0 0 3 3v6m0-16v6m3-6v7a3 3 0 0 1-3 3m9-10c-2 0-3 3-3 6s1 4 3 4v6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" /></svg>
      {{ t.app.name }}
    </RouterLink>
    <nav :aria-label="t.app.nav.label">
      <RouterLink v-for="link in links" :key="link.name" :to="{ name: link.name }" class="nav-link">
        {{ link.label }}
      </RouterLink>
    </nav>
    <RouterLink class="button" :to="otherLanguage" :hreflang="other" :lang="other" :aria-label="t.app.language.switchLabel" @click="chosen = other">
      {{ t.app.language.switchTo }}
    </RouterLink>
    <button type="button" class="button icon-button" :aria-label="label" :title="label" @click="colorMode = next[colorMode]">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <circle v-if="colorMode === 'light'" cx="12" cy="12" r="4" />
        <path v-if="colorMode === 'light'" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        <path v-else-if="colorMode === 'dark'" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        <template v-else>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8m-4-4v4" />
        </template>
      </svg>
    </button>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text);
  font-weight: 700;
  text-decoration: none;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  flex: 1;
}

.nav-link {
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-small);
  color: var(--text);
  text-decoration: none;
}

.nav-link:hover {
  background: var(--surface-sunken);
}

.nav-link.router-link-active {
  color: var(--brand-strong);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--brand);
}

@media (max-width: 40rem) {
  nav {
    order: 3;
    flex-basis: 100%;
  }

  .brand {
    flex: 1;
  }
}
</style>
