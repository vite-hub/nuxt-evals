<script setup lang="ts">
import { useI18n } from "../i18n"

// What a missing page or recipe shows. The page around it sets the title.
const { t } = useI18n()
</script>

<template>
  <div class="page not-found">
    <h1 tabindex="-1">
      {{ t.notFound.title }}
    </h1>
    <p class="muted">
      {{ t.notFound.body }}
    </p>
    <RouterLink class="button primary" :to="{ name: 'recipes' }">
      {{ t.notFound.back }}
    </RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  text-align: center;
}
</style>
