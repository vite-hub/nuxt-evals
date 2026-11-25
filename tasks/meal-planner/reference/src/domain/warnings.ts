import type { Allergen, Diet, Ingredient, IngredientLine, Person } from "./types.ts"

/** Why a recipe doesn't suit someone. */
export type Reason =
  | { kind: "diet", diet: Diet, ingredient: Ingredient }
  | { kind: "allergy", allergen: Allergen, ingredient: Ingredient }
  /** A typed-in ingredient the catalog doesn't know: it can't be checked, so it isn't called safe. */
  | { kind: "unknown", name: string }

export interface Warning {
  person: Person
  reason: Reason
}

/** What a diet rules out, read from the ingredient's own fields. */
const breaks: Record<Diet, (ingredient: Ingredient) => boolean> = {
  "vegetarian": ingredient => ingredient.animal === "meat" || ingredient.animal === "fish",
  "vegan": ingredient => ingredient.animal !== undefined,
  "gluten-free": ingredient => Boolean(ingredient.gluten) || Boolean(ingredient.allergens?.includes("gluten")),
  "dairy-free": ingredient => ingredient.animal === "dairy" || Boolean(ingredient.allergens?.includes("dairy")),
}

/**
 * Why the ingredients don't suit each person: diets and allergies against the catalog's `animal`, `gluten` and
 * `allergens`, so custom recipes are checked like the built-in ones. Typed-in ingredients are reported as unknown for
 * anyone with a diet or an allergy.
 */
export function warningsFor(lines: readonly IngredientLine[], people: readonly Person[], catalog: ReadonlyMap<string, Ingredient>): Warning[] {
  const warnings: Warning[] = []
  for (const person of people) {
    if (!person.diets.length && !person.allergies.length) continue
    for (const line of lines) {
      const ingredient = "ingredient" in line ? catalog.get(line.ingredient) : undefined
      if (!ingredient) {
        warnings.push({ person, reason: { kind: "unknown", name: "name" in line ? line.name : line.ingredient } })
        continue
      }
      for (const diet of person.diets) if (breaks[diet](ingredient)) warnings.push({ person, reason: { kind: "diet", diet, ingredient } })
      for (const allergen of person.allergies) if (ingredient.allergens?.includes(allergen)) warnings.push({ person, reason: { kind: "allergy", allergen, ingredient } })
    }
  }
  return warnings
}

/** A key that names a warning: the person, the rule and the ingredient. */
export function warningKey({ person, reason }: Warning): string {
  if (reason.kind === "unknown") return `${person.id}:unknown:${reason.name}`
  return `${person.id}:${reason.kind === "diet" ? reason.diet : reason.allergen}:${reason.ingredient.id}`
}
