<script setup lang="ts">
import { computed } from "vue"
import { caloriesPerPerson } from "../domain/plan"
import { meals, type PlanEntry } from "../domain/types"
import { useI18n } from "../i18n"
import { usePlanner } from "./planner-context"
import PlannerSlot from "./PlannerSlot.vue"

const props = defineProps<{ date: string, today: boolean, entries: PlanEntry[] }>()
const { summary } = usePlanner()
const { t, formatDate, formatNumber } = useI18n()

const weekday = computed(() => formatDate(props.date, { weekday: "long" }))
const label = computed(() => formatDate(props.date, { day: "numeric", month: "short" }))
const calories = computed(() => formatNumber(caloriesPerPerson(props.entries, id => summary(id)?.caloriesPerServing)))
</script>

<template>
  <li class="day" :class="{ today }" :aria-current="today ? 'date' : undefined">
    <h2 class="day-name">
      {{ weekday }} <span class="date">{{ label }}</span>
      <span v-if="today" class="today-badge">{{ t.plan.today }}</span>
    </h2>
    <p class="calories">
      {{ entries.length ? t.plan.caloriesPerPerson(calories) : t.plan.nothing }}
    </p>
    <PlannerSlot
      v-for="meal in meals"
      :key="meal"
      :date="date"
      :meal="meal"
      :day-label="`${weekday} ${label}`"
      :entries="entries.filter(entry => entry.meal === meal)"
    />
  </li>
</template>

<style scoped>
.day {
  display: grid;
  align-content: start;
  gap: 0.5rem;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.day.today {
  border: 2px solid var(--brand);
}

.day-name {
  margin: 0;
  font-size: 1rem;
}

.date {
  color: var(--muted);
  font-weight: 500;
}

.today-badge {
  display: inline-block;
  margin-left: 0.25rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--brand-strong);
  color: var(--on-brand);
  font-size: 0.75rem;
  vertical-align: middle;
}

.calories {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}
</style>
