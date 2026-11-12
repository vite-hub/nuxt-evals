// The list index: what the recipe list needs of every built-in recipe, in columns, so 20,000 recipes parse in a
// blink and filtering walks plain arrays. The build writes it from data/recipes.json (build/recipe-data.ts); full
// recipes stay in shards that load on demand. Orders are sorted at build time too, by name once per language.
import { foldText } from "./text.ts"
import { type Course, courses, type Diet, diets, type Language, type Recipe } from "./types.ts"

export const sorts = ["rating", "time", "name", "newest"] as const
export type Sort = (typeof sorts)[number]

export interface RecipeIndex {
  version: 1
  cuisines: string[]
  ids: number[]
  titles: string[]
  /** Folded title and cuisine, for search. */
  search: string[]
  cuisine: number[]
  course: number[]
  /** Diets as bits, in the order of `diets`. */
  diets: number[]
  minutes: number[]
  kcal: number[]
  servings: number[]
  /** The rating in tenths (3.5 → 35). */
  rating: number[]
  /** Positions in display order: rating, time and newest are the same in both languages; name has one per language. */
  order: Record<"rating" | "time" | "newest" | `name-${Language}`, number[]>
}

/** What a card in the list shows of a recipe, built-in or custom. */
export interface RecipeSummary {
  id: string
  title: string
  cuisine: string
  course: Course
  diets: Diet[]
  minutes: number
  caloriesPerServing?: number
  servings: number
  rating?: number
  custom?: true
}

export const dietBits = (list: readonly Diet[]) => list.reduce((bits, diet) => bits | (1 << diets.indexOf(diet)), 0)
const dietsOf = (bits: number) => diets.filter((_, at) => bits & (1 << at))

export function buildIndex(recipes: readonly Recipe[]): RecipeIndex {
  const cuisines = [...new Set(recipes.map(recipe => recipe.cuisine))].sort()
  const positions = recipes.map((_, at) => at)
  const byName = (language: Language) => {
    const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true })
    return [...positions].sort((a, b) => collator.compare(recipes[a]!.title, recipes[b]!.title) || a - b)
  }
  const sorted = (compare: (a: Recipe, b: Recipe) => number) => [...positions].sort((a, b) => compare(recipes[a]!, recipes[b]!) || a - b)
  return {
    version: 1,
    cuisines,
    ids: recipes.map(recipe => Number(recipe.id)),
    titles: recipes.map(recipe => recipe.title),
    search: recipes.map(recipe => foldText(`${recipe.title} ${recipe.cuisine}`)),
    cuisine: recipes.map(recipe => cuisines.indexOf(recipe.cuisine)),
    course: recipes.map(recipe => courses.indexOf(recipe.course)),
    diets: recipes.map(recipe => dietBits(recipe.diets)),
    minutes: recipes.map(recipe => recipe.minutes),
    kcal: recipes.map(recipe => recipe.caloriesPerServing ?? 0),
    servings: recipes.map(recipe => recipe.servings),
    rating: recipes.map(recipe => Math.round((recipe.rating ?? 0) * 10)),
    order: {
      "rating": sorted((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)),
      "time": sorted((a, b) => a.minutes - b.minutes),
      "newest": sorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
      "name-en": byName("en"),
      "name-es": byName("es"),
    },
  }
}

const numbers = (value: unknown, length: number): value is number[] => Array.isArray(value) && value.length === length && value.every(Number.isInteger)
const texts = (value: unknown, length: number): value is string[] => Array.isArray(value) && value.length === length && value.every(item => typeof item === "string")

/** The index as fetched, checked column by column, or null when it has the wrong shape. */
export function parseIndex(value: unknown): RecipeIndex | null {
  if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1) return null
  const index = value as Partial<Record<keyof RecipeIndex, unknown>>
  const length = Array.isArray(index.ids) ? index.ids.length : -1
  const columns = [index.ids, index.cuisine, index.course, index.diets, index.minutes, index.kcal, index.servings, index.rating]
  const order = index.order as Partial<Record<keyof RecipeIndex["order"], unknown>> | undefined
  if (length < 1 || !columns.every(column => numbers(column, length)) || !texts(index.titles, length) || !texts(index.search, length)) return null
  if (!Array.isArray(index.cuisines) || !index.cuisines.every(item => typeof item === "string")) return null
  if (!order || !(["rating", "time", "newest", "name-en", "name-es"] as const).every(key => numbers(order[key], length))) return null
  return index as RecipeIndex
}

export function summaryAt(index: RecipeIndex, at: number): RecipeSummary {
  const rating = index.rating[at]!
  return {
    id: String(index.ids[at]),
    title: index.titles[at]!,
    cuisine: index.cuisines[index.cuisine[at]!] ?? "",
    course: courses[index.course[at]!] ?? "main",
    diets: dietsOf(index.diets[at]!),
    minutes: index.minutes[at]!,
    caloriesPerServing: index.kcal[at]!,
    servings: index.servings[at]!,
    ...(rating ? { rating: rating / 10 } : {}),
  }
}

export interface ListFilters {
  q: string
  diets: Diet[]
  cuisine: string | null
  maxMinutes: number | null
  sort: Sort
}

/** Positions in the index that match, in the chosen order. One pass over plain arrays: fast enough to run per key. */
export function searchIndex(index: RecipeIndex, filters: ListFilters, language: Language): number[] {
  const words = foldText(filters.q).split(/\s+/).filter(Boolean)
  const wanted = dietBits(filters.diets)
  const cuisine = filters.cuisine === null ? -1 : index.cuisines.indexOf(filters.cuisine)
  const order = index.order[filters.sort === "name" ? `name-${language}` as const : filters.sort]
  const found: number[] = []
  for (const at of order) {
    if ((index.diets[at]! & wanted) !== wanted) continue
    if (cuisine >= 0 && index.cuisine[at] !== cuisine) continue
    if (filters.maxMinutes !== null && index.minutes[at]! > filters.maxMinutes) continue
    if (words.length && !words.every(word => index.search[at]!.includes(word))) continue
    found.push(at)
  }
  return found
}

/** Custom recipes that match, in the chosen order. Their text is folded as they are searched: there are only a few. */
export function searchSummaries(list: readonly RecipeSummary[], filters: ListFilters, language: Language): RecipeSummary[] {
  const words = foldText(filters.q).split(/\s+/).filter(Boolean)
  return list.filter(recipe =>
    filters.diets.every(diet => recipe.diets.includes(diet))
    && (filters.cuisine === null || recipe.cuisine === filters.cuisine)
    && (filters.maxMinutes === null || recipe.minutes <= filters.maxMinutes)
    && words.every(word => foldText(`${recipe.title} ${recipe.cuisine}`).includes(word)))
    .sort(compareBy(filters.sort, language))
}

/**
 * How two recipes compare in an order, the same way the build sorted the index: best rating first, quickest first,
 * by name in the language. Newest puts custom recipes first, since they are newer than the data.
 */
export function compareBy(sort: Sort, language: Language): (a: RecipeSummary, b: RecipeSummary) => number {
  const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true })
  if (sort === "name") return (a, b) => collator.compare(a.title, b.title)
  if (sort === "time") return (a, b) => a.minutes - b.minutes
  if (sort === "rating") return (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
  return (a, b) => Number(Boolean(b.custom)) - Number(Boolean(a.custom))
}

/** Index positions and custom recipes in one order, merging two lists that are each sorted already. */
export function mergeResults(index: RecipeIndex, found: readonly number[], custom: readonly RecipeSummary[], sort: Sort, language: Language): Found[] {
  if (!custom.length) return [...found]
  const compare = compareBy(sort, language)
  const merged: Found[] = []
  let next = 0
  for (let position = 0; position < found.length; position++) {
    if (next === custom.length) return [...merged, ...found.slice(position)]
    const at = found[position]!
    while (next < custom.length && compare(custom[next]!, summaryAt(index, at)) <= 0) merged.push(custom[next++]!)
    merged.push(at)
  }
  return [...merged, ...custom.slice(next)]
}

/** A search result: a position in the index, or one of the user's own recipes. */
export type Found = number | RecipeSummary

/** Every recipe that matches, built-in and the user's own, in one order. */
export function searchAll(index: RecipeIndex, mine: readonly RecipeSummary[], filters: ListFilters, language: Language): Found[] {
  return mergeResults(index, searchIndex(index, filters, language), searchSummaries(mine, filters, language), filters.sort, language)
}

export const summaryOf = (index: RecipeIndex, found: Found): RecipeSummary => typeof found === "number" ? summaryAt(index, found) : found
