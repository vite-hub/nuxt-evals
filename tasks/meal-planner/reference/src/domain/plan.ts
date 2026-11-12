import type { Meal, PlanEntry } from "./types.ts"

export interface Slot {
  date: string
  meal: Meal
}

// The plan is an immutable list: every change returns a new one, so the undo history can keep each version as is.

export function addToPlan(plan: readonly PlanEntry[], entry: PlanEntry): PlanEntry[] {
  return [...plan, entry]
}

/** One entry changed: moved to another slot, eaten by other people, or swapped for another recipe. */
export function updateInPlan(plan: readonly PlanEntry[], id: string, change: Partial<Omit<PlanEntry, "id">>): PlanEntry[] {
  return plan.map(entry => entry.id === id ? { ...entry, ...change } : entry)
}

export function removeFromPlan(plan: readonly PlanEntry[], ids: readonly string[]): PlanEntry[] {
  return plan.filter(entry => !ids.includes(entry.id))
}

/** Calories one person eats on a day: the sum of each planned meal's calories per serving. */
export function caloriesPerPerson(entries: readonly PlanEntry[], kcal: (recipeId: string) => number | undefined): number {
  return entries.reduce((sum, entry) => sum + (kcal(entry.recipeId) ?? 0), 0)
}

/** The planned meals on the given days, such as one week's. */
export function entriesOn(plan: readonly PlanEntry[], days: readonly string[]): PlanEntry[] {
  return plan.filter(entry => days.includes(entry.date))
}

/** A week's meals copied into the plan, next to the meals already there or instead of them. */
export function copyIntoWeek(plan: readonly PlanEntry[], days: readonly string[], incoming: readonly PlanEntry[], mode: "merge" | "replace"): PlanEntry[] {
  return [...(mode === "replace" ? plan.filter(entry => !days.includes(entry.date)) : plan), ...incoming]
}

/** The meals that plan a recipe, such as one about to be deleted. */
export function entriesOf(plan: readonly PlanEntry[], recipeId: string): PlanEntry[] {
  return plan.filter(entry => entry.recipeId === recipeId)
}
