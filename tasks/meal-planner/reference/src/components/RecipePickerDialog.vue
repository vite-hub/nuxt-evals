<script setup lang="ts">
import { useRecipeSearch } from "../composables/recipe-search"
import type { RecipeSummary } from "../domain/recipe-index"
import { useI18n } from "../i18n"
import AppDialog from "./AppDialog.vue"

defineProps<{ title: string }>()
const emit = defineEmits<{ pick: [recipe: RecipeSummary], close: [] }>()
const { q, results } = useRecipeSearch(20)
const { t, cuisineName } = useI18n()

function pick(recipe: RecipeSummary, close: () => void) {
  emit("pick", recipe)
  close()
}
</script>

<template>
  <AppDialog v-slot="{ close }" :title="title" @close="emit('close')">
    <label class="field">
      <span>{{ t.list.search }}</span>
      <input v-model="q" class="input" type="search" autocomplete="off" autofocus>
    </label>
    <ul class="results">
      <li v-for="recipe in results" :key="recipe.id">
        <button type="button" class="pick" @click="pick(recipe, close)">
          {{ recipe.title }} <span class="muted">· {{ cuisineName(recipe.cuisine) }}, {{ t.words.minutes(recipe.minutes) }}</span>
        </button>
      </li>
    </ul>
    <p v-if="!results.length" class="muted">
      {{ t.plan.noMatch }}
    </p>
    <div class="toolbar">
      <button type="button" class="button" @click="close">
        {{ t.app.cancel }}
      </button>
    </div>
  </AppDialog>
</template>

<style scoped>
.results {
  display: grid;
  gap: 0.25rem;
  max-height: 50vh;
  margin: 0.75rem 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.pick {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid transparent;
  border-radius: var(--radius-small);
  background: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pick:hover {
  border-color: var(--border);
  background: var(--surface-sunken);
}
</style>
