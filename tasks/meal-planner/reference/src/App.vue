<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue"
import ToastRegion from "./components/ToastRegion.vue"
import UpdateBanner from "./components/UpdateBanner.vue"
import { useRecipes } from "./composables/recipes"
import { storageFailed } from "./composables/storage"
import { useRoute } from "vue-router"
import { useI18n } from "./i18n"

const { t } = useI18n()
const route = useRoute()
void useRecipes().load()
</script>

<template>
  <a class="skip-link" href="#main">{{ t.app.skip }}</a>
  <!-- The header's links need the URL's language, which the first navigation brings. -->
  <AppHeader v-if="route.matched.length" />
  <UpdateBanner />
  <p v-if="storageFailed" class="storage-warning no-print" role="alert">
    {{ t.app.storageFailed }}
  </p>
  <main id="main" tabindex="-1">
    <RouterView />
  </main>
  <ToastRegion />
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: 1rem;
  top: -4rem;
  z-index: 10;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-small);
  background: var(--brand-strong);
  color: var(--on-brand);
}

.skip-link:focus {
  top: 0.5rem;
}

main:focus {
  outline: none;
}

.storage-warning {
  margin: 0;
  padding: 0.6rem 1rem;
  background: var(--brand-soft);
  color: var(--text);
  text-align: center;
}
</style>
