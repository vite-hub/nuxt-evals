<script setup lang="ts">
import { useRecipeSearch } from "../composables/recipe-search"
import { startDrag } from "../drag"
import { useI18n } from "../i18n"
import { usePlanner } from "./planner-context"

const { q, results } = useRecipeSearch(12)
const { t } = useI18n()
const { open } = usePlanner()
</script>

<template>
  <aside class="shelf card no-print" aria-labelledby="shelf-title">
    <h2 id="shelf-title">
      {{ t.plan.shelf }}
    </h2>
    <p id="shelf-help" class="muted help">
      {{ t.plan.shelfHelp }}
    </p>
    <label class="field">
      <span>{{ t.plan.find }}</span>
      <input v-model="q" class="input" type="search" autocomplete="off" aria-describedby="shelf-help">
    </label>
    <ul class="results">
      <li v-for="recipe in results" :key="recipe.id">
        <!-- Dragged with a mouse, or tapped and pressed like any button to open the plan dialog. -->
        <button type="button" draggable="true" class="result" :aria-label="t.list.planLabel(recipe.title)" @dragstart="startDrag($event, { kind: 'recipe', id: recipe.id })" @click="open('plan', recipe.id)">
          <span class="grip" aria-hidden="true">⠿</span>
          <span>{{ recipe.title }}</span>
        </button>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.shelf {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  padding: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.05rem;
}

.help {
  margin: 0;
  font-size: 0.85rem;
}

.results {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result {
  display: flex;
  width: 100%;
  color: var(--text);
  font: inherit;
  text-align: left;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-small);
  background: var(--surface);
  cursor: grab;
  font-size: 0.9rem;
}

.grip {
  color: var(--muted);
}
</style>
