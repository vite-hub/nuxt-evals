import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseIngredient, parseRecipe, validItems } from "../domain/schema"
import type { Ingredient, Recipe } from "../domain/types"

const read = (name: string): unknown => JSON.parse(readFileSync(join(import.meta.dirname, "../../data", name), "utf8"))

/** The real ingredients, so tests use the data's densities, piece weights and allergens. */
export const catalog: ReadonlyMap<string, Ingredient> = new Map((validItems(read("ingredients.json"), parseIngredient) ?? []).map(item => [item.id, item]))

let recipes: Recipe[] | undefined
/** The real recipes (20,289; read once, only by the tests that need them). */
export function dataRecipes(): Recipe[] {
  return (recipes ??= validItems(read("recipes.json"), parseRecipe) ?? [])
}

export const recipeById = (id: number) => {
  const recipe = dataRecipes().find(item => item.id === String(id))
  if (!recipe) throw new Error(`No recipe ${id} in the data.`)
  return recipe
}
