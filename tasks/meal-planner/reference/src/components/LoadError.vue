<script setup lang="ts">
import { useRecipes } from "../composables/recipes"
import { useI18n } from "../i18n"

const { load } = useRecipes()
const { t } = useI18n()
</script>

<template>
  <div class="empty" role="alert">
    <p>{{ t.app.loadError }}</p>
    <button type="button" class="button primary" @click="load">
      {{ t.app.retry }}
    </button>
  </div>
</template>
