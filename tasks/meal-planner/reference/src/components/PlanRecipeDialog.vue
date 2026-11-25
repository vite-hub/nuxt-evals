<script setup lang="ts">
import { usePlanActions } from "../composables/plan-actions"
import { toDateKey } from "../domain/dates"
import type { Slot } from "../domain/plan"
import type { RecipeSummary } from "../domain/recipe-index"
import { useI18n } from "../i18n"
import PlanDialog from "./PlanDialog.vue"

// Opens on `initial` (the week the planner shows), else on the slot last planned into, else on tonight's dinner.
const props = defineProps<{ recipe: Pick<RecipeSummary, "id" | "title">, initial?: Slot }>()
defineEmits<{ close: [] }>()
const { t } = useI18n()
const actions = usePlanActions()
const start: Slot = props.initial ?? actions.lastSlot.value ?? { date: toDateKey(new Date()), meal: "dinner" }
</script>

<template>
  <PlanDialog :title="t.dialog.planTitle(recipe.title)" :action="t.dialog.add" :initial="start" :eaters="null" @confirm="(slot, eaters) => actions.add(recipe, slot, eaters)" @close="$emit('close')" />
</template>
