import { createGlobalState, useManualRefHistory } from "@vueuse/core"
import { toRaw, watch } from "vue"
import { addToPlan, copyIntoWeek, removeFromPlan, type Slot, updateInPlan } from "../domain/plan"
import { isRecord, parsePlanEntry, validItems } from "../domain/schema"
import type { PlanEntry } from "../domain/types"
import { useVersionedStorage } from "./storage"

/**
 * The week plan, with undo and redo. Every change replaces the list, so the history keeps each version without copying.
 * Undo and redo write the plan like any change, so they are saved and reach other tabs. Callers tell the user what
 * happened; this only changes the plan.
 */
export const usePlan = createGlobalState(() => {
  const plan = useVersionedStorage<PlanEntry[]>("meal-planner:plan", {
    version: 2,
    parse: data => validItems(data, parsePlanEntry),
    // Version 1 planned servings per meal; version 2 plans who eats. Old meals become everyone's.
    migrate: { 2: data => Array.isArray(data) ? data.map(entry => isRecord(entry) ? { ...entry, eaters: null } : entry) : data },
    initial: [],
  })
  const history = useManualRefHistory(plan, { capacity: 50 })

  // A change from elsewhere (another tab, an import) isn't this tab's to undo: undoing past it would silently drop it,
  // so the history starts over.
  watch(plan, (value) => {
    if (toRaw(value) !== toRaw(history.last.value.snapshot)) {
      history.commit()
      history.clear()
    }
  })

  function change(next: PlanEntry[]) {
    plan.value = next
    history.commit()
  }

  return {
    plan,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    add: (recipeId: string, slot: Slot, eaters: string[] | null = null) => change(addToPlan(plan.value, { id: crypto.randomUUID(), recipeId, eaters, ...slot })),
    /** Moves a meal, changes who eats it, or swaps its recipe. */
    update: (id: string, entry: Partial<Omit<PlanEntry, "id">>) => change(updateInPlan(plan.value, id, entry)),
    remove: (ids: readonly string[]) => change(removeFromPlan(plan.value, ids)),
    /** Copies a shared week's meals in; undoable like any change. */
    copy: (days: readonly string[], meals: readonly Omit<PlanEntry, "id">[], mode: "merge" | "replace") =>
      change(copyIntoWeek(plan.value, days, meals.map(meal => ({ ...meal, id: crypto.randomUUID() })), mode)),
    /** Returns whether there was something to undo. */
    undo() {
      const can = history.canUndo.value
      history.undo()
      return can
    },
    /** Returns whether there was something to redo. */
    redo() {
      const can = history.canRedo.value
      history.redo()
      return can
    },
  }
})
