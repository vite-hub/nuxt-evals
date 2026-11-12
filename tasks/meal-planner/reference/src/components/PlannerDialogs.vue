<script setup lang="ts">
import { computed } from "vue"
import { useHousehold } from "../composables/household"
import { usePlanActions } from "../composables/plan-actions"
import { useQueryDialog } from "../composables/query-dialog"
import { useRecipes } from "../composables/recipes"
import type { Slot } from "../domain/plan"
import { shareWeek } from "../domain/share"
import { meals, type PlanEntry } from "../domain/types"
import { focusAfterRender } from "../focus"
import { useI18n } from "../i18n"
import EatersDialog from "./EatersDialog.vue"
import type { PlannerDialog } from "./planner-context"
import PlanDialog from "./PlanDialog.vue"
import PlanRecipeDialog from "./PlanRecipeDialog.vue"
import RecipePickerDialog from "./RecipePickerDialog.vue"
import ShareDialog from "./ShareDialog.vue"

// The planner's dialogs. Each lives in the URL (`?move=<id>`), so Back closes it; the planner context opens them.
const props = defineProps<{ week: string, days: readonly string[], entries: readonly PlanEntry[], defaultSlot: Slot }>()
const { t, formatSlot } = useI18n()
const actions = usePlanActions()
const recipes = useRecipes()
const { people } = useHousehold()

const dialog = (key: PlannerDialog) => useQueryDialog(key)
const adding = dialog("add")
const moving = dialog("move")
const eating = dialog("eaters")
const swapping = dialog("swap")
const sharing = dialog("share")
const planning = dialog("plan")

const entryFor = (id: string | undefined) => props.entries.find(entry => entry.id === id)
const movingEntry = computed(() => entryFor(moving.current.value))
const eatingEntry = computed(() => entryFor(eating.current.value))
const swappingEntry = computed(() => entryFor(swapping.current.value))
const planningRecipe = computed(() => planning.current.value ? recipes.summary(planning.current.value) : undefined)
const addSlot = computed((): Slot | undefined => {
  const [date, mealName] = adding.current.value?.split("/") ?? []
  const meal = meals.find(item => item === mealName)
  return date && meal && props.days.includes(date) ? { date, meal } : undefined
})
const shared = computed(() => shareWeek(props.week, props.entries, people.value, {
  servings: id => recipes.summary(id)?.servings,
  custom: recipes.custom.value,
}))

function move(entry: PlanEntry, slot: Slot, eaters: string[] | null) {
  // A meal moved to another week leaves this page's list, and the dialog with it: close it here, not on its way out.
  moving.close()
  if (actions.move(entry, slot, eaters)) void focusAfterRender(`[data-entry="${entry.id}"] a`)
}
</script>

<template>
  <RecipePickerDialog v-if="addSlot" :title="t.plan.addTo(formatSlot(addSlot))" @pick="actions.add($event, addSlot)" @close="adding.close" />
  <PlanRecipeDialog v-if="planningRecipe" :recipe="planningRecipe" :initial="defaultSlot" @close="planning.close" />
  <PlanDialog
    v-if="movingEntry"
    :title="t.dialog.moveTitle(actions.titleOf(movingEntry.recipeId))"
    :action="t.dialog.move"
    :initial="movingEntry"
    :eaters="movingEntry.eaters"
    @confirm="(slot, eaters) => move(movingEntry!, slot, eaters)"
    @close="moving.close"
  />
  <EatersDialog v-if="eatingEntry" :title="t.dialog.eatersTitle(actions.titleOf(eatingEntry.recipeId))" :entry="eatingEntry" @confirm="actions.setEaters(eatingEntry!, $event)" @close="eating.close" />
  <RecipePickerDialog v-if="swappingEntry" :title="t.plan.swapFor(actions.titleOf(swappingEntry.recipeId))" @pick="actions.swap(swappingEntry!, $event)" @close="swapping.close" />
  <ShareDialog v-if="sharing.current.value" :week="shared" @close="sharing.close" />
</template>
