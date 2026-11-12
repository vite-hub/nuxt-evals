<script setup lang="ts">
import { computed } from "vue"
import { useRecipes } from "../composables/recipes"
import type { PlanEntry } from "../domain/types"
import { useI18n } from "../i18n"

// Meals whose recipe couldn't be loaded (offline, or a network error) are said, not silently left out of warnings and
// the shopping list.
const props = defineProps<{ entries: readonly PlanEntry[] }>()
const { t } = useI18n()
const recipes = useRecipes()
const unloaded = computed(() => props.entries.filter(entry => recipes.state(entry.recipeId) === "unavailable"))
</script>

<template>
  <div v-if="unloaded.length" class="unloaded" role="alert">
    <span>{{ t.plan.unloaded(unloaded.length) }}</span>
    <button type="button" class="button small" @click="recipes.ensure(unloaded.map(entry => entry.recipeId))">
      {{ t.app.retry }}
    </button>
  </div>
</template>

<style scoped>
.unloaded {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin: 0 0 1rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--danger);
  border-radius: var(--radius-small);
}
</style>
