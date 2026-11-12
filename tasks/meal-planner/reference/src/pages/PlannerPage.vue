<script setup lang="ts">
import { useTitle } from "@vueuse/core"
import { computed, provide, watch } from "vue"
import LoadError from "../components/LoadError.vue"
import { type PlannerDialog, plannerKey } from "../components/planner-context"
import PlannerDay from "../components/PlannerDay.vue"
import PlannerDialogs from "../components/PlannerDialogs.vue"
import RecipeShelf from "../components/RecipeShelf.vue"
import UnloadedMeals from "../components/UnloadedMeals.vue"
import WeekNav from "../components/WeekNav.vue"
import { useHousehold } from "../composables/household"
import { usePlan } from "../composables/plan"
import { usePlanActions } from "../composables/plan-actions"
import { useOpenDialog } from "../composables/query-dialog"
import { useRecipes } from "../composables/recipes"
import { useUndoShortcuts } from "../composables/undo-shortcuts"
import { useWeek } from "../composables/week"
import { eatersOf } from "../domain/household"
import { entriesOn, type Slot } from "../domain/plan"
import type { PlanEntry } from "../domain/types"
import { type Warning, warningsFor } from "../domain/warnings"
import type { DragItem } from "../drag"
import { focusAfterRender } from "../focus"
import { useI18n } from "../i18n"

const props = defineProps<{ week?: string }>()
const { t } = useI18n()
const { plan } = usePlan()
const actions = usePlanActions()
const recipes = useRecipes()
const { people } = useHousehold()
const week = useWeek(() => props.week)
useTitle(computed(() => t.value.app.title(t.value.plan.pageTitle(week.label.value))))
useUndoShortcuts(actions.undo, actions.redo)

const weekEntries = computed(() => entriesOn(plan.value, week.days.value))
// Warnings need the whole recipes of the week: load their shards.
watch(weekEntries, entries => void recipes.ensure(entries.map(entry => entry.recipeId)), { immediate: true })
const warnings = computed(() => new Map(weekEntries.value.flatMap((entry): [string, Warning[]][] => {
  const recipe = recipes.recipe(entry.recipeId)
  return recipe ? [[entry.id, warningsFor(recipe.ingredients, eatersOf(entry, people.value), recipes.catalog.value)]] : []
})))
/** Where "Plan" on the shelf starts: today's dinner when the week is this one, its Monday's otherwise. */
const defaultSlot = computed((): Slot => ({ date: week.isCurrent.value ? week.today.value : week.key.value, meal: "dinner" }))

function drop(item: DragItem, slot: Slot) {
  if (item.kind === "entry") {
    const entry = plan.value.find(candidate => candidate.id === item.id)
    if (entry && actions.move(entry, slot)) void focusAfterRender(`[data-entry="${entry.id}"] a`)
    return
  }
  const recipe = recipes.summary(item.id)
  if (recipe) actions.add(recipe, slot)
}

function remove(entry: PlanEntry) {
  actions.remove(entry)
  void focusAfterRender(`[data-slot="${entry.date}/${entry.meal}"] .add`)
}

function clearWeek() {
  if (weekEntries.value.length && window.confirm(t.value.plan.clearConfirm(weekEntries.value.length))) actions.clear(weekEntries.value)
}

const open = useOpenDialog<PlannerDialog>()
provide(plannerKey, {
  summary: recipes.summary,
  people,
  warnings,
  drop,
  open,
  remove,
})
</script>

<template>
  <div class="page planner">
    <WeekNav :title="t.plan.title" route="plan" :week="week" />

    <p v-if="recipes.status.value === 'loading'" class="muted" role="status">
      {{ t.app.loading }}
    </p>
    <LoadError v-else-if="recipes.status.value === 'error'" />
    <template v-else>
      <!-- aria-disabled, not disabled: focus stays on the button after the last undo or redo. -->
      <div class="toolbar actions">
        <button type="button" class="button" :aria-disabled="!actions.canUndo.value" aria-keyshortcuts="Control+Z Meta+Z" @click="actions.undo">
          {{ t.plan.undo }}
        </button>
        <button type="button" class="button" :aria-disabled="!actions.canRedo.value" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" @click="actions.redo">
          {{ t.plan.redo }}
        </button>
        <RouterLink class="button" :to="{ name: 'shopping', params: { week: week.key.value } }">
          {{ t.plan.shopping }}
        </RouterLink>
        <button type="button" class="button" :aria-disabled="!weekEntries.length" @click="weekEntries.length && open('share', 'week')">
          {{ t.plan.share }}
        </button>
        <button type="button" class="button danger" @click="clearWeek">
          {{ t.plan.clear }}
        </button>
      </div>
      <UnloadedMeals :entries="weekEntries" />
      <p v-if="!people.length" class="muted hint">
        {{ t.plan.noHousehold }}
        <RouterLink :to="{ name: 'household' }">
          {{ t.recipe.addPeople }}
        </RouterLink>
      </p>

      <div class="layout">
        <RecipeShelf />
        <div class="week-scroll">
          <ol class="days">
            <PlannerDay
              v-for="date in week.days.value"
              :key="date"
              :date="date"
              :today="date === week.today.value"
              :entries="weekEntries.filter(entry => entry.date === date)"
            />
          </ol>
        </div>
      </div>
    </template>

    <PlannerDialogs :week="week.key.value" :days="week.days.value" :entries="weekEntries" :default-slot="defaultSlot" />
  </div>
</template>

<style scoped>
.planner {
  max-width: 100rem;
}

.actions {
  margin: 0 0 1rem;
}

.hint {
  margin: 0 0 1rem;
}

.layout {
  display: grid;
  grid-template-columns: 16rem minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.week-scroll {
  overflow-x: auto;
}

.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(11rem, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0 0 0.5rem;
  list-style: none;
}

@media (max-width: 60rem) {
  .layout {
    grid-template-columns: 1fr;
  }

  .days {
    grid-template-columns: 1fr;
  }

  /* On a phone the week comes first; the shelf is for dragging with a mouse. */
  .layout > :first-child {
    order: 2;
  }
}
</style>
