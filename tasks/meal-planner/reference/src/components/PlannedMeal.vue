<script setup lang="ts">
import { computed } from "vue"
import { eatersOf, portions } from "../domain/household"
import type { PlanEntry } from "../domain/types"
import { warningKey } from "../domain/warnings"
import { startDrag } from "../drag"
import { useI18n } from "../i18n"
import { usePlanner } from "./planner-context"

const props = defineProps<{ entry: PlanEntry }>()
const planner = usePlanner()
const { t, formatList, describeWarning } = useI18n()
const recipe = computed(() => planner.summary(props.entry.recipeId))
const name = computed(() => recipe.value?.title ?? t.value.plan.deletedRecipe)
const warnings = computed(() => planner.warnings.value.get(props.entry.id) ?? [])
const eating = computed(() => {
  const people = planner.people.value
  if (!people.length) return recipe.value ? t.value.plan.portions(portions(props.entry, people, recipe.value)) : ""
  const eaters = eatersOf(props.entry, people)
  if (props.entry.eaters === null) return t.value.plan.everyone
  return eaters.length ? formatList(eaters.map(person => person.name)) : t.value.plan.nobody
})
</script>

<template>
  <li class="meal" :class="{ warned: warnings.length }" :data-entry="entry.id" :draggable="Boolean(recipe)" @dragstart="startDrag($event, { kind: 'entry', id: entry.id })">
    <RouterLink v-if="recipe" :to="{ name: 'recipe', params: { id: recipe.id } }" class="title">
      {{ recipe.title }}
    </RouterLink>
    <span v-else class="title muted">{{ t.plan.deletedRecipe }}</span>
    <p v-if="eating" class="eating">
      {{ eating }}
    </p>
    <ul v-if="warnings.length" class="warnings">
      <li v-for="warning in warnings" :key="warningKey(warning)">
        <span aria-hidden="true">⚠</span> {{ describeWarning(warning) }}
      </li>
    </ul>
    <div class="actions">
      <button v-if="recipe" type="button" class="button small" :aria-label="`${t.plan.move}: ${name}`" @click="planner.open('move', entry.id)">
        {{ t.plan.move }}
      </button>
      <button v-if="recipe && planner.people.value.length" type="button" class="button small" :aria-label="`${t.plan.eaters}: ${name}`" @click="planner.open('eaters', entry.id)">
        {{ t.plan.eaters }}
      </button>
      <button type="button" class="button small" :aria-label="t.plan.swapFor(name)" @click="planner.open('swap', entry.id)">
        {{ t.plan.swap }}
      </button>
      <button type="button" class="button small" :aria-label="`${t.plan.remove}: ${name}`" @click="planner.remove(entry)">
        {{ t.plan.remove }}
      </button>
    </div>
  </li>
</template>

<style scoped>
.meal {
  display: grid;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-small);
  background: var(--surface);
}

.meal.warned {
  border-color: var(--danger);
}

.meal[draggable="true"] {
  cursor: grab;
}

.title {
  font-weight: 600;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.eating {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.warnings {
  margin: 0;
  padding: 0;
  color: var(--danger);
  font-size: 0.8rem;
  list-style: none;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
</style>
