<script setup lang="ts">
import { ref } from "vue"
import { carriesItem, droppedItem } from "../drag"
import type { Meal, PlanEntry } from "../domain/types"
import { useI18n } from "../i18n"
import PlannedMeal from "./PlannedMeal.vue"
import { usePlanner } from "./planner-context"

const props = defineProps<{ date: string, meal: Meal, dayLabel: string, entries: PlanEntry[] }>()
const planner = usePlanner()
const { t } = useI18n()
const over = ref(false)

function allow(event: DragEvent) {
  if (!carriesItem(event)) return
  event.preventDefault()
  over.value = true
}

function drop(event: DragEvent) {
  over.value = false
  const item = droppedItem(event)
  if (!item) return
  event.preventDefault()
  planner.drop(item, { date: props.date, meal: props.meal })
}
</script>

<template>
  <section class="slot" :class="{ over }" :data-slot="`${date}/${meal}`" :aria-label="`${dayLabel}, ${t.words.meals[meal]}`" @dragenter="allow" @dragover="allow" @dragleave="over = false" @drop="drop">
    <h3 class="meal-name">
      {{ t.words.meals[meal] }}
    </h3>
    <ul v-if="entries.length" class="entries">
      <PlannedMeal v-for="entry in entries" :key="entry.id" :entry="entry" />
    </ul>
    <button type="button" class="button small add" :aria-label="t.plan.addTo(`${dayLabel}, ${t.words.meals[meal]}`)" @click="planner.open('add', `${date}/${meal}`)">
      {{ t.plan.add }}
    </button>
  </section>
</template>

<style scoped>
.slot {
  display: grid;
  align-content: start;
  gap: 0.4rem;
  min-height: 5.5rem;
  padding: 0.5rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-small);
  background: var(--surface-sunken);
  transition: border-color 120ms, background-color 120ms;
}

.slot.over {
  border: 1px solid var(--brand);
  background: var(--brand-soft);
}

.meal-name {
  margin: 0;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.entries {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.add {
  justify-self: start;
}
</style>
