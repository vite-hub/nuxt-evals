import { type ListFilters, type Sort, sorts } from "./recipe-index.ts"
import { diets } from "./types.ts"

export const pageSize = 24
export const timeLimits = [15, 30, 45, 60, 90, 120] as const

export interface ListState extends ListFilters {
  page: number
}

export const defaultListState: ListState = { q: "", diets: [], cuisine: null, maxMinutes: null, sort: "rating", page: 1 }

type QueryValue = string | null | (string | null)[] | undefined
export type ListQuery = Record<string, string | string[]>

const values = (value: QueryValue): string[] => (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === "string")
const first = (value: QueryValue): string | undefined => values(value)[0]

/**
 * The list's state from the URL. Values that make no sense (a hand-edited `?time=abc`) fall back to the default.
 * `cuisines` is the known list once the data is in; until then any cuisine is kept.
 */
export function parseListQuery(query: Record<string, QueryValue>, cuisines: readonly string[] | null): ListState {
  const time = Number(first(query.time))
  const page = Number(first(query.page))
  const cuisine = first(query.cuisine) ?? null
  const sort = first(query.sort)
  return {
    q: first(query.q)?.trim() ?? "",
    diets: diets.filter(diet => values(query.diet).includes(diet)),
    cuisine: cuisine && (!cuisines || cuisines.includes(cuisine)) ? cuisine : null,
    maxMinutes: (timeLimits as readonly number[]).includes(time) ? time : null,
    sort: sorts.includes(sort as Sort) ? sort as Sort : defaultListState.sort,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** The URL query for a state, leaving defaults out so a fresh list is a clean `/`. */
export function toListQuery(state: ListState): ListQuery {
  const query: ListQuery = {}
  if (state.q) query.q = state.q
  if (state.diets.length) query.diet = [...state.diets]
  if (state.cuisine) query.cuisine = state.cuisine
  if (state.maxMinutes !== null) query.time = String(state.maxMinutes)
  if (state.sort !== defaultListState.sort) query.sort = state.sort
  if (state.page > 1) query.page = String(state.page)
  return query
}

const listKeys = ["q", "diet", "cuisine", "time", "sort", "page"]

/** Whether a URL's list parameters say the same as a clean query, so a clean URL isn't replaced again. */
export function sameQuery(a: Record<string, QueryValue>, b: ListQuery): boolean {
  return listKeys.every(key => values(a[key]).join("\n") === values(b[key]).join("\n"))
}
