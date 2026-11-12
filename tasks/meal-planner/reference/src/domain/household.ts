import type { PlanEntry, Person, Recipe } from "./types.ts"

/** The people eating a planned meal: everyone, or the ones it names who are still in the household. */
export function eatersOf(entry: PlanEntry, people: readonly Person[]): Person[] {
  const { eaters } = entry
  return eaters === null ? [...people] : people.filter(person => eaters.includes(person.id))
}

/**
 * How many portions a planned meal makes: one per person eating it. Without a household, the recipe as written, so
 * the planner works before anyone is added.
 */
export function portions(entry: PlanEntry, people: readonly Person[], recipe: Pick<Recipe, "servings">): number {
  return people.length ? eatersOf(entry, people).length : recipe.servings
}

/** Who eats, from the people ticked: everyone when all are ticked, so people added later eat it too. */
export function eatersFrom(ticked: readonly string[], people: readonly Person[]): string[] | null {
  const ids = people.filter(person => ticked.includes(person.id)).map(person => person.id)
  return ids.length === people.length ? null : ids
}
