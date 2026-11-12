// Checks for every piece of data that comes from outside the code: the recipe files, browser storage, and imported
// files. Each parser builds a fresh object with only the known fields, so a stray `__proto__` or extra field never
// reaches the app, and returns null when the value has the wrong shape.
import { parseDateKey } from "./dates.ts"
import { allergens, animals, type ColorMode, type Course, courses, diets, type Ingredient, type IngredientLine, type Language, languages, type Meal, meals, type Pantry, type Person, type PlanEntry, type Recipe, type Settings, type ShoppingState, type UnitSystem } from "./types.ts"
import { isUnit } from "./units.ts"

type Data = Record<string, unknown>

export const isRecord = (value: unknown): value is Data => typeof value === "object" && value !== null && !Array.isArray(value)
export const isText = (value: unknown): value is string => typeof value === "string"
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0
const isPositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => list.includes(value as T)
const textList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText)
const listOf = <T extends string>(list: readonly T[], value: unknown): value is T[] => Array.isArray(value) && value.every(item => oneOf(list, item))

/** JSON.parse that drops keys which could reach an object's prototype if the value were ever merged. */
export function parseJson(text: string): unknown {
  return JSON.parse(text, (key, value: unknown) => key === "__proto__" || key === "constructor" || key === "prototype" ? undefined : value)
}

/** Keeps the items that pass, so one bad item doesn't throw away the rest. */
export function validItems<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  return value.map(parse).filter((item): item is T => item !== null)
}

export function parseIngredient(value: unknown): Ingredient | null {
  if (!isRecord(value) || !isText(value.id) || !isText(value.name) || !isRecord(value.names) || !isText(value.names.es) || !isText(value.aisle)) return null
  const found = value.allergens === undefined ? [] : listOf(allergens, value.allergens) ? value.allergens : null
  if (!found) return null
  return {
    id: value.id,
    name: value.name,
    names: { es: value.names.es },
    aisle: value.aisle,
    ...(oneOf(animals, value.animal) ? { animal: value.animal } : {}),
    ...(value.gluten === true ? { gluten: true } : {}),
    ...(found.length ? { allergens: [...found] } : {}),
    ...(isPositive(value.gramsPerCup) ? { gramsPerCup: value.gramsPerCup } : {}),
    ...(isPositive(value.gramsPerPiece) ? { gramsPerPiece: value.gramsPerPiece } : {}),
  }
}

export function parseIngredientLine(value: unknown): IngredientLine | null {
  if (!isRecord(value)) return null
  const toTaste = value.quantity === null && value.unit === null
  if (!toTaste && !(isPositive(value.quantity) && isUnit(value.unit))) return null
  const amount = { quantity: toTaste ? null : value.quantity as number, unit: toTaste ? null : value.unit as IngredientLine["unit"] }
  const note = isText(value.note) && value.note.trim() ? { note: value.note } : {}
  if (isText(value.ingredient) && value.ingredient) return { ingredient: value.ingredient, ...amount, ...note }
  if (isText(value.name) && value.name.trim()) return { name: value.name, ...amount, ...note }
  return null
}

/** A recipe from the data files (`id` a number) or from the user (`id` starting with `custom-`). */
export function parseRecipe(value: unknown): Recipe | null {
  if (!isRecord(value)) return null
  const id = typeof value.id === "number" && Number.isInteger(value.id) ? String(value.id) : value.id
  const custom = value.custom === true
  if (!isText(id) || custom !== id.startsWith("custom-")) return null
  if (!isText(value.title) || !value.title.trim() || !isText(value.description) || !isText(value.cuisine) || !oneOf<Course>(courses, value.course)) return null
  if (!listOf(diets, value.diets)) return null
  if (!isCount(value.minutes) || !isPositive(value.servings) || !Number.isInteger(value.servings)) return null
  if (value.caloriesPerServing !== undefined && !isCount(value.caloriesPerServing)) return null
  if (!isText(value.createdAt) || !parseDateKey(value.createdAt) || !textList(value.steps)) return null
  const ingredients = Array.isArray(value.ingredients) ? value.ingredients.map(parseIngredientLine) : []
  if (!ingredients.length || ingredients.includes(null)) return null
  const rating = typeof value.rating === "number" && isCount(value.ratingCount) ? { rating: value.rating, ratingCount: value.ratingCount } : {}
  return {
    id,
    title: value.title,
    description: value.description,
    cuisine: value.cuisine,
    course: value.course,
    diets: [...value.diets],
    minutes: value.minutes,
    servings: value.servings,
    ...(isCount(value.caloriesPerServing) ? { caloriesPerServing: value.caloriesPerServing } : {}),
    ...rating,
    createdAt: value.createdAt,
    ingredients: ingredients as IngredientLine[],
    steps: [...value.steps],
    ...(custom ? { custom: true as const } : {}),
  }
}

export function parsePlanEntry(value: unknown): PlanEntry | null {
  if (!isRecord(value) || !isText(value.id) || !isText(value.date) || !parseDateKey(value.date) || !oneOf<Meal>(meals, value.meal)) return null
  if (!isText(value.recipeId) || !(value.eaters === null || textList(value.eaters))) return null
  return { id: value.id, date: value.date, meal: value.meal, recipeId: value.recipeId, eaters: value.eaters === null ? null : [...value.eaters] }
}

export function parsePerson(value: unknown): Person | null {
  if (!isRecord(value) || !isText(value.id) || !isText(value.name) || !value.name.trim()) return null
  if (!listOf(diets, value.diets) || !listOf(allergens, value.allergies)) return null
  return { id: value.id, name: value.name, diets: [...value.diets], allergies: [...value.allergies] }
}

export function parseShopping(value: unknown): ShoppingState | null {
  if (!isRecord(value) || !isRecord(value.ticked)) return null
  const ticked: Record<string, string[]> = {}
  for (const [week, keys] of Object.entries(value.ticked)) if (parseDateKey(week) && textList(keys)) ticked[week] = [...keys]
  return { ticked }
}

export function parsePantry(value: unknown): Pantry | null {
  if (!isRecord(value)) return null
  const pantry: Pantry = {}
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item) || !isPositive(item.quantity) || !isUnit(item.unit)) return null
    pantry[key] = { quantity: item.quantity, unit: item.unit }
  }
  return pantry
}

export function parseSettings(value: unknown): Settings | null {
  if (!isRecord(value) || !oneOf<UnitSystem>(["metric", "us"], value.units) || !oneOf<ColorMode>(["auto", "light", "dark"], value.colorMode)) return null
  return { units: value.units, colorMode: value.colorMode, language: oneOf<Language>(languages, value.language) ? value.language : null }
}

/** Everything that belongs to the user, as an export file holds it. */
export interface UserData {
  plan: PlanEntry[]
  people: Person[]
  recipes: Recipe[]
  shopping: ShoppingState
  pantry: Pantry
  settings: Settings
}

export const exportFormat = "meal-planner-export"
export const exportVersion = 2
/** Exports of real use stay far below this. A bigger file is not one of ours. */
export const maxImportBytes = 5 * 1024 * 1024

/** Why an import file was refused. The app says it in the user's language. */
export type ImportError = "not-json" | "not-export" | "version" | "damaged"
export type ImportResult = { ok: true, data: UserData } | { ok: false, error: ImportError }

/** Every item parsed, or null when one of them doesn't pass. */
function allOrNothing<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  const items = validItems(value, parse)
  return items && Array.isArray(value) && items.length === value.length ? items : null
}

/** An import file, all or nothing: a file with one bad recipe is refused, so the user's data never half-changes. */
export function parseExport(text: string): ImportResult {
  let value: unknown
  try {
    value = parseJson(text)
  }
  catch {
    return { ok: false, error: "not-json" }
  }
  if (!isRecord(value) || value.format !== exportFormat) return { ok: false, error: "not-export" }
  if (value.version !== exportVersion) return { ok: false, error: "version" }
  const plan = allOrNothing(value.plan, parsePlanEntry)
  const people = allOrNothing(value.people, parsePerson)
  const recipes = allOrNothing(value.recipes, parseRecipe)
  const shopping = parseShopping(value.shopping)
  const pantry = parsePantry(value.pantry)
  const settings = parseSettings(value.settings)
  if (!plan || !people || !recipes || recipes.some(recipe => !recipe.custom) || !shopping || !pantry || !settings) return { ok: false, error: "damaged" }
  return { ok: true, data: { plan, people, recipes, shopping, pantry, settings } }
}

export function toExport(data: UserData): string {
  return JSON.stringify({ format: exportFormat, version: exportVersion, exportedAt: new Date().toISOString(), ...data }, null, 2)
}
