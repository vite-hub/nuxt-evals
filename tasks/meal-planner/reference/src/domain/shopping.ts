import { formatAmount, isPlural, type Wording } from "./format.ts"
import { catalogName, countedName, ingredientKey, scaledBase } from "./ingredients.ts"
import { portions } from "./household.ts"
import type { Ingredient, Language, Pantry, PlanEntry, Person, Recipe, UnitSystem } from "./types.ts"
import { type BaseAmount, combineAmounts, convertTo, displayAmount, toBase, type Weights } from "./units.ts"

export interface ShoppingItem {
  key: string
  /** The catalog's ingredient, or undefined for one a custom recipe typed in. */
  ingredient?: Ingredient
  /** The name a custom recipe typed, when the catalog doesn't know the ingredient. */
  typedName: string
  /** The catalog's aisle (in English, as the data has it), or `otherAisle`. */
  aisle: string
  /** What the week's meals need, added up (see `combineAmounts`). */
  needed: BaseAmount[]
  /** What is still missing after the pantry. Empty when the pantry covers it all. */
  missing: BaseAmount[]
  /** Amounts that couldn't be added up, because the data has no density or piece weight for this ingredient. */
  apart: boolean
  /** Some recipe uses it "to taste". */
  toTaste: boolean
  /** The pantry has some of it. */
  inPantry: boolean
}

export interface Aisle {
  name: string
  items: ShoppingItem[]
}

/** The aisle of typed-in ingredients the catalog doesn't know. */
export const otherAisle = "Other"
/** Aisles in the order a walk through a shop meets them. */
export const aisleOrder = ["Produce", "Meat & fish", "Dairy & eggs", "Bakery", "Baking", "Pantry", "Spices", "Condiments", "Frozen", otherAisle]
const aisleRank = (aisle: string) => aisleOrder.includes(aisle) ? aisleOrder.indexOf(aisle) : aisleOrder.length - 1

const enough = 1e-6

/**
 * Takes what the pantry has from what is needed, converting through grams when the units differ (1 cup of flour from a
 * need in grams). Returns what is still missing.
 */
export function subtractPantry(needed: readonly BaseAmount[], have: BaseAmount | undefined, weights: Weights): BaseAmount[] {
  let left = have
  return needed.flatMap((need) => {
    const usable = left && convertTo(left, need.dimension, weights)
    if (!left || !usable) return [need]
    const used = Math.min(usable, need.value)
    left = { ...left, value: left.value * (1 - used / usable) }
    return need.value - used > need.value * enough ? [{ ...need, value: need.value - used }] : []
  })
}

/**
 * The week's shopping list: every ingredient of the planned meals, scaled to the people eating each one, added up,
 * less what the pantry has, grouped by aisle. Meals whose recipe isn't known (deleted, or not loaded yet) are skipped.
 */
export function shoppingList(entries: readonly PlanEntry[], recipes: ReadonlyMap<string, Recipe>, catalog: ReadonlyMap<string, Ingredient>, people: readonly Person[], pantry: Pantry, language: Language): Aisle[] {
  const parts = new Map<string, { item: Omit<ShoppingItem, "needed" | "missing" | "apart" | "inPantry">, amounts: BaseAmount[] }>()
  for (const entry of entries) {
    const recipe = recipes.get(entry.recipeId)
    if (!recipe) continue
    const factor = portions(entry, people, recipe) / recipe.servings
    if (!factor) continue
    for (const line of recipe.ingredients) {
      const key = ingredientKey(line)
      const ingredient = "ingredient" in line ? catalog.get(line.ingredient) : undefined
      const part = parts.get(key) ?? { item: { key, ...(ingredient ? { ingredient } : {}), typedName: "name" in line ? line.name : key, aisle: ingredient?.aisle ?? otherAisle, toTaste: false }, amounts: [] }
      parts.set(key, part)
      const base = scaledBase(line, factor)
      if (base) part.amounts.push(base)
      else part.item.toTaste = true
    }
  }
  const collator = new Intl.Collator(language)
  const aisles = new Map<string, ShoppingItem[]>()
  for (const { item, amounts } of parts.values()) {
    const weights = item.ingredient ?? {}
    const needed = combineAmounts(amounts, weights)
    const stock = pantry[item.key]
    const have = stock ? toBase(stock.quantity, stock.unit) : undefined
    const list = aisles.get(item.aisle) ?? []
    list.push({ ...item, needed, missing: subtractPantry(needed, have, weights), apart: needed.length > 1, inPantry: Boolean(stock) })
    aisles.set(item.aisle, list)
  }
  const name = (item: ShoppingItem) => item.ingredient ? catalogName(item.ingredient, language) : item.typedName
  return [...aisles].map(([aisle, list]) => ({ name: aisle, items: list.sort((a, b) => collator.compare(name(a), name(b))) }))
    .sort((a, b) => aisleRank(a.name) - aisleRank(b.name))
}

/** Whether the pantry covers an item whole. "To taste" items always stay on the list, without a number. */
export const isCovered = (item: ShoppingItem) => !item.missing.length && !item.toTaste

/** An item as the list shows it: `Eggs` and `3`, `All-purpose flour` and `153 g`, what is missing and what is needed. */
export function displayItem(item: ShoppingItem, system: UnitSystem, wording: Wording): { name: string, missing: string[], needed: string[] } {
  const show = (amounts: BaseAmount[]) => amounts.map(base => displayAmount(base, system))
  const missing = show(item.missing)
  const needed = show(item.needed)
  const plural = [...missing, ...needed].some(amount => amount.unit === "piece" && isPlural(amount))
  const name = item.ingredient ? catalogName(item.ingredient, wording.language) : item.typedName
  return {
    name: countedName(item.key, name, plural, wording),
    missing: missing.map(amount => formatAmount(amount, wording)),
    needed: needed.map(amount => formatAmount(amount, wording)),
  }
}
