import { inject, type InjectionKey, type Ref } from "vue"
import type { Slot } from "../domain/plan"
import type { RecipeSummary } from "../domain/recipe-index"
import type { PlanEntry, Person } from "../domain/types"
import type { Warning } from "../domain/warnings"
import type { DragItem } from "../drag"

/** What the planner page gives its days, slots and planned meals: what to show, and what to do when the user acts. */
export interface PlannerContext {
  summary: (recipeId: string) => RecipeSummary | undefined
  people: Readonly<Ref<readonly Person[]>>
  /** Each planned meal's warnings, once its recipe is loaded; undefined while it loads. */
  warnings: Readonly<Ref<ReadonlyMap<string, Warning[]>>>
  drop: (item: DragItem, slot: Slot) => void
  /** Opens one of the planner's dialogs, which live in the URL: `open("move", entry.id)`. */
  open: (dialog: PlannerDialog, value: string) => void
  remove: (entry: PlanEntry) => void
}

/** The query parameter each planner dialog lives in (see PlannerDialogs). */
export type PlannerDialog = "add" | "move" | "eaters" | "swap" | "share" | "plan"

export const plannerKey: InjectionKey<PlannerContext> = Symbol("planner")

export function usePlanner(): PlannerContext {
  const context = inject(plannerKey)
  if (!context) throw new Error("Planner components need the planner page around them.")
  return context
}
