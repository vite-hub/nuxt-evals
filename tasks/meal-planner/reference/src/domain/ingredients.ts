import { formatAmount, isPlural, type Wording } from "./format.ts"
import { foldText } from "./text.ts"
import type { Ingredient, IngredientLine, Language, UnitSystem } from "./types.ts"
import { type BaseAmount, displayAmount, toBase } from "./units.ts"

/** What a shopping list adds up by: the catalog id, or the folded name of a typed-in ingredient. */
export function ingredientKey(line: IngredientLine): string {
  return "ingredient" in line ? line.ingredient : `text:${foldText(line.name)}`
}

/** An ingredient's name in the language. Typed-in ingredients keep what the user typed. */
export function ingredientName(line: IngredientLine, catalog: ReadonlyMap<string, Ingredient>, language: Language = "en"): string {
  if (!("ingredient" in line)) return line.name
  const ingredient = catalog.get(line.ingredient)
  return ingredient ? catalogName(ingredient, language) : line.ingredient
}

export function catalogName(ingredient: Ingredient, language: Language): string {
  return language === "es" ? ingredient.names.es : ingredient.name
}

/** The catalog's ingredient a typed name means, in either language, ignoring case and accents. */
export function findIngredient(name: string, catalog: ReadonlyMap<string, Ingredient>): Ingredient | undefined {
  const folded = foldText(name.trim())
  return folded ? [...catalog.values()].find(item => foldText(item.name) === folded || foldText(item.names.es) === folded) : undefined
}

/** The line's amount scaled by `factor`, in base units, or null for "to taste". */
export function scaledBase(line: IngredientLine, factor: number): BaseAmount | null {
  return line.quantity === null || line.unit === null ? null : toBase(line.quantity * factor, line.unit)
}

/** The name with a counted piece's number agreeing: `1 Egg`, `2 Eggs`. */
export function countedName(key: string, name: string, plural: boolean, wording: Wording): string {
  const forms = Object.hasOwn(wording.counted, key) ? wording.counted[key] : undefined
  return forms ? forms[plural ? 1 : 0] : name
}

export interface DisplayLine {
  amount: string | null
  name: string
  note?: string
}

export function displayLine(line: IngredientLine, factor: number, system: UnitSystem, catalog: ReadonlyMap<string, Ingredient>, wording: Wording): DisplayLine {
  const base = scaledBase(line, factor)
  const name = ingredientName(line, catalog, wording.language)
  const note = line.note ? { note: line.note } : {}
  if (!base) return { amount: null, name, ...note }
  const amount = displayAmount(base, system)
  return {
    amount: formatAmount(amount, wording),
    name: amount.unit === "piece" ? countedName(ingredientKey(line), name, isPlural(amount), wording) : name,
    ...note,
  }
}
