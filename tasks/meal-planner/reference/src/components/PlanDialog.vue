<script setup lang="ts">
import { computed, ref } from "vue"
import { useHousehold } from "../composables/household"
import { useWeek } from "../composables/week"
import { addDays, parseDateKey, toDateKey } from "../domain/dates"
import { eatersFrom } from "../domain/household"
import type { Slot } from "../domain/plan"
import { type Meal, meals } from "../domain/types"
import { useI18n } from "../i18n"
import AppDialog from "./AppDialog.vue"

// Picks a day, a meal and who eats, with taps alone: a week of day buttons, three meals, the household's names.
const props = defineProps<{ title: string, action: string, initial: Slot, eaters: string[] | null }>()
const emit = defineEmits<{ confirm: [slot: Slot, eaters: string[] | null], close: [] }>()
const { t, formatDate } = useI18n()
const { people } = useHousehold()

const date = ref(props.initial.date)
const meal = ref<Meal>(props.initial.meal)
const shownWeek = ref(props.initial.date)
const week = useWeek(shownWeek)
const chosen = ref<string[]>(props.eaters ?? people.value.map(person => person.id))

const days = computed(() => week.days.value.map(key => ({
  key,
  weekday: formatDate(key, { weekday: "short" }),
  date: formatDate(key, { day: "numeric", month: "short" }),
  today: key === week.today.value,
})))
// `today` is a date key the week built itself, so it parses.
const tomorrow = computed(() => toDateKey(addDays(parseDateKey(week.today.value)!, 1)))

function confirm(close: () => void) {
  emit("confirm", { date: date.value, meal: meal.value }, eatersFrom(chosen.value, people.value))
  close()
}
</script>

<template>
  <AppDialog v-slot="{ close }" :title="title" @close="emit('close')">
    <form class="plan-form" @submit.prevent="confirm(close)">
      <fieldset class="group">
        <legend class="legend">
          {{ t.dialog.day }} <span class="muted">{{ week.label.value }}</span>
        </legend>
        <div class="week-nav">
          <button type="button" class="button small" @click="shownWeek = week.previous.value">
            <span aria-hidden="true">←</span> {{ t.dialog.previousWeek }}
          </button>
          <button type="button" class="button small" @click="shownWeek = week.next.value">
            {{ t.dialog.nextWeek }} <span aria-hidden="true">→</span>
          </button>
        </div>
        <div class="choices days">
          <label v-for="day in days" :key="day.key" class="choice">
            <input v-model="date" type="radio" name="day" :value="day.key">
            <span>
              <strong>{{ day.weekday }}</strong> {{ day.date }}
              <small v-if="day.today">{{ t.plan.today }}</small>
              <small v-else-if="day.key === tomorrow">{{ t.dialog.tomorrow }}</small>
            </span>
          </label>
        </div>
      </fieldset>
      <fieldset class="group">
        <legend class="legend">
          {{ t.dialog.meal }}
        </legend>
        <div class="choices">
          <label v-for="item in meals" :key="item" class="choice">
            <input v-model="meal" type="radio" name="meal" :value="item">
            <span>{{ t.words.meals[item] }}</span>
          </label>
        </div>
      </fieldset>
      <fieldset v-if="people.length" class="group">
        <legend class="legend">
          {{ t.plan.eaters }}
        </legend>
        <div class="choices">
          <label v-for="person in people" :key="person.id" class="choice">
            <input v-model="chosen" type="checkbox" :value="person.id">
            <span>{{ person.name }}</span>
          </label>
        </div>
      </fieldset>
      <div class="toolbar">
        <button type="submit" class="button primary">
          {{ action }}
        </button>
        <button type="button" class="button" @click="close">
          {{ t.app.cancel }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>

<style scoped>
.plan-form {
  display: grid;
  gap: 1rem;
}

.group {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.week-nav {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
}

.choice {
  position: relative;
  cursor: pointer;
}

/* The input stays for keyboards and screen readers; its label is the visible button. */
.choice input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
}

.choice span {
  display: grid;
  min-height: 2.75rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-small);
  text-align: center;
  align-content: center;
}

.choice small {
  font-size: 0.75rem;
}

.choice input:checked + span {
  border-color: var(--brand-strong);
  background: var(--brand-strong);
  color: var(--on-brand);
}

.choice input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>
