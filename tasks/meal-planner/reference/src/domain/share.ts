// A week travels in its link: the meals as a compact JSON array, compressed with the platform's CompressionStream and
// written in base64url. Built-in recipes go by their number; custom recipes go whole, so the receiver sees them too.
// 21 built-in meals come to a few hundred characters.
import { parseDateKey, weekDays } from "./dates.ts"
import { portions } from "./household.ts"
import { parseJson, parseRecipe } from "./schema.ts"
import { type Meal, meals, type PlanEntry, type Person, type Recipe } from "./types.ts"

export interface SharedMeal {
  /** 0 is Monday. */
  day: number
  meal: Meal
  recipeId: string
  /** How many people eat it at the sender's table. */
  eaters: number
}

export interface SharedWeek {
  /** The Monday's date key. */
  week: string
  meals: SharedMeal[]
  /** The custom recipes the meals use. */
  recipes: Recipe[]
}

/** The link can't be read: cut short, changed, or not a shared week at all. */
export class ShareError extends Error {}

const format = 1

async function run(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes.slice()]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[\w-]+$/.test(text)) throw new ShareError("Not base64url.")
  return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0))
}

const isCount = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max

function parseMeal(item: unknown): SharedMeal | null {
  if (!Array.isArray(item) || item.length !== 4) return null
  const [day, meal, id, eaters]: unknown[] = item
  const mealName = typeof meal === "number" ? meals[meal] : undefined
  const recipeId = isCount(id, 1, Number.MAX_SAFE_INTEGER) ? String(id) : typeof id === "string" && id.startsWith("custom-") ? id : null
  if (!isCount(day, 0, 6) || !mealName || !recipeId || !isCount(eaters, 1, 99)) return null
  return { day, meal: mealName, recipeId, eaters }
}

export async function encodeWeek(week: SharedWeek): Promise<string> {
  const compact = [format, week.week, week.meals.map(meal => [meal.day, meals.indexOf(meal.meal), /^\d+$/.test(meal.recipeId) ? Number(meal.recipeId) : meal.recipeId, meal.eaters]), week.recipes]
  return toBase64Url(await run(new TextEncoder().encode(JSON.stringify(compact)), new CompressionStream("deflate-raw")))
}

/** The week in a link, checked whole. Throws ShareError when anything in it is off, so nothing half-read is used. */
export async function decodeWeek(text: string): Promise<SharedWeek> {
  let value: unknown
  try {
    value = parseJson(new TextDecoder().decode(await run(fromBase64Url(text), new DecompressionStream("deflate-raw"))))
  }
  catch (error) {
    throw error instanceof ShareError ? error : new ShareError("The link's data doesn't decompress.")
  }
  if (!Array.isArray(value) || value[0] !== format || typeof value[1] !== "string" || !parseDateKey(value[1]) || !Array.isArray(value[2]) || !Array.isArray(value[3])) {
    throw new ShareError("Not a shared week.")
  }
  const shared = value[2].map(parseMeal).filter(item => item !== null)
  // Only the sender's own recipes travel whole: a link can't redefine a built-in recipe.
  const recipes = value[3].map(parseRecipe).filter((item): item is Recipe => item?.custom === true)
  if (shared.length !== value[2].length || recipes.length !== value[3].length) throw new ShareError("Part of the shared week is damaged.")
  const carried = new Set(recipes.map(recipe => recipe.id))
  if (shared.some(meal => meal.recipeId.startsWith("custom-") && !carried.has(meal.recipeId))) throw new ShareError("A meal names a recipe the link doesn't carry.")
  return { week: value[1], meals: shared, recipes }
}

/**
 * A week of the plan as its link carries it. Built-in recipes go by number; the custom ones the week uses go whole.
 * Each meal says how many eat it at the sender's table.
 */
export function shareWeek(week: string, entries: readonly PlanEntry[], people: readonly Person[], recipes: { servings: (id: string) => number | undefined, custom: readonly Recipe[] }): SharedWeek {
  const monday = parseDateKey(week)
  const days = monday ? weekDays(monday) : []
  const inWeek = entries.filter(entry => days.includes(entry.date))
  const used = new Set(inWeek.map(entry => entry.recipeId))
  return {
    week,
    meals: inWeek.map(entry => ({
      day: days.indexOf(entry.date),
      meal: entry.meal,
      recipeId: entry.recipeId,
      eaters: Math.max(1, portions(entry, people, { servings: recipes.servings(entry.recipeId) ?? 1 })),
    })),
    recipes: recipes.custom.filter(recipe => used.has(recipe.id)),
  }
}

/** A shared week's meals as plan entries of the receiver, eaten by their whole household. */
export function sharedEntries(shared: SharedWeek): Omit<PlanEntry, "id">[] {
  const monday = parseDateKey(shared.week)
  const days = monday ? weekDays(monday) : []
  return shared.meals.flatMap(meal => days[meal.day] ? [{ date: days[meal.day]!, meal: meal.meal, recipeId: meal.recipeId, eaters: null }] : [])
}
