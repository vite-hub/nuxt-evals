import { createGlobalState } from "@vueuse/core"
import { shallowRef } from "vue"
import type { Slot } from "../domain/plan"
import type { RecipeSummary } from "../domain/recipe-index"
import type { PlanEntry } from "../domain/types"
import { useI18n } from "../i18n"
import { usePlan } from "./plan"
import { useRecipes } from "./recipes"
import { notify } from "./toasts"

/** The slot the user last planned into, so the next "Plan" opens on the same week. */
const useLastSlot = createGlobalState(() => shallowRef<Slot>())

/**
 * Changes to the plan as the user makes them: each one changes the plan, says what happened, and offers Undo.
 * Pages call these; `usePlan` stays a plain store.
 */
export function usePlanActions() {
  const { t, formatSlot } = useI18n()
  const plan = usePlan()
  const recipes = useRecipes()
  const lastSlot = useLastSlot()
  const titleOf = (recipeId: string) => recipes.summary(recipeId)?.title ?? t.value.plan.deletedRecipe

  function undo() {
    if (plan.undo()) notify(t.value.plan.undone)
  }
  function redo() {
    if (plan.redo()) notify(t.value.plan.redone)
  }
  const announce = (message: string) => notify(message, "info", { label: t.value.app.undo, run: undo })

  return {
    lastSlot,
    titleOf,
    undo,
    redo,
    canUndo: plan.canUndo,
    canRedo: plan.canRedo,
    add(recipe: Pick<RecipeSummary, "id" | "title">, slot: Slot, eaters: string[] | null = null) {
      plan.add(recipe.id, slot, eaters)
      lastSlot.value = slot
      announce(t.value.plan.added(recipe.title, formatSlot(slot)))
    },
    /** Moves a meal, and changes who eats it when `eaters` differ. Returns whether anything changed. */
    move(entry: PlanEntry, slot: Slot, eaters = entry.eaters): boolean {
      if (entry.date === slot.date && entry.meal === slot.meal && JSON.stringify(eaters) === JSON.stringify(entry.eaters)) return false
      plan.update(entry.id, { ...slot, eaters })
      announce(t.value.plan.moved(titleOf(entry.recipeId), formatSlot(slot)))
      return true
    },
    remove(entry: PlanEntry) {
      plan.remove([entry.id])
      announce(t.value.plan.removed(titleOf(entry.recipeId), formatSlot(entry)))
    },
    clear(entries: readonly PlanEntry[]) {
      plan.remove(entries.map(entry => entry.id))
      announce(t.value.plan.cleared)
    },
    setEaters(entry: PlanEntry, eaters: string[] | null) {
      plan.update(entry.id, { eaters })
      announce(t.value.plan.eatersChanged(titleOf(entry.recipeId)))
    },
    swap(entry: PlanEntry, recipe: Pick<RecipeSummary, "id" | "title">) {
      const before = titleOf(entry.recipeId)
      plan.update(entry.id, { recipeId: recipe.id })
      announce(t.value.plan.swapped(before, recipe.title))
    },
  }
}
