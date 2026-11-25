import { computed, shallowRef } from "vue"
import { parseDateKey } from "../domain/dates"
import type { Wording } from "../domain/format"
import { catalogName } from "../domain/ingredients"
import type { Slot } from "../domain/plan"
import { type Language, languages } from "../domain/types"
import type { Warning } from "../domain/warnings"
import { en, type Messages } from "./en"
import { es } from "./es"

export type { Messages }

const catalogs: Record<Language, Messages> = { en, es }

/** The page's language. The router sets it from the URL (`/es/...`) before each page renders. */
export const language = shallowRef<Language>("en")
export const messages = computed(() => catalogs[language.value])
/** The words amounts need, for the domain's formatting (`formatAmount`, `displayLine`, `displayItem`). */
export const wording = computed<Wording>(() => ({ language: language.value, units: messages.value.words.units, counted: messages.value.words.counted }))

export function isLanguage(value: unknown): value is Language {
  return languages.includes(value as Language)
}

/** The first of the browser's languages the app speaks, or English. */
export function browserLanguage(): Language {
  return navigator.languages.map(tag => tag.slice(0, 2)).find(isLanguage) ?? "en"
}

// Intl formatters are slow to build, so each one is made once per language and options.
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.ListFormat>()
function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.ListFormat>(kind: string, options: object, make: () => T): T {
  const key = `${kind}:${language.value}:${JSON.stringify(options)}`
  let formatter = formatters.get(key)
  if (!formatter) formatters.set(key, formatter = make())
  return formatter as T
}

export function formatNumber(value: number): string {
  return cached("number", {}, () => new Intl.NumberFormat(language.value)).format(value)
}

/** A date key in the page's language: `formatDate("2026-11-10", { weekday: "long" })` → `Tuesday`. */
export function formatDate(key: string, options: Intl.DateTimeFormatOptions): string {
  const date = parseDateKey(key)
  return date ? cached("date", options, () => new Intl.DateTimeFormat(language.value, options)).format(date) : key
}

/** `Ana, Bo and Di`. */
export function formatList(items: string[]): string {
  return cached("list", {}, () => new Intl.ListFormat(language.value, { type: "conjunction" })).format(items)
}

/** A cuisine's name in the page's language. The data's names are English; one the catalog doesn't know stays as it is. */
export function cuisineName(cuisine: string): string {
  const names = messages.value.words.cuisines
  return Object.hasOwn(names, cuisine) ? names[cuisine]! : cuisine
}

/** An aisle's name in the page's language. */
export function aisleName(aisle: string): string {
  const names = messages.value.words.aisles
  return Object.hasOwn(names, aisle) ? names[aisle]! : aisle
}

/** Messages and formats for the page's language. */
export function useI18n() {
  return {
    t: messages,
    language,
    wording,
    formatNumber,
    formatDate,
    formatList,
    cuisineName,
    aisleName,
    /** `Not for Ana (allergic to peanuts): Peanut butter`. */
    describeWarning({ person, reason }: Warning): string {
      const t = messages.value
      if (reason.kind === "unknown") return t.warnings.unknown(person.name, reason.name)
      const ingredient = catalogName(reason.ingredient, language.value)
      return reason.kind === "diet" ? t.warnings.diet(person.name, t.words.diets[reason.diet], ingredient) : t.warnings.allergy(person.name, t.words.allergens[reason.allergen], ingredient)
    },
    /** `Tuesday, November 10, dinner`. */
    formatSlot: (slot: Slot) => `${formatDate(slot.date, { weekday: "long", day: "numeric", month: "long" })}, ${messages.value.words.meals[slot.meal].toLocaleLowerCase(language.value)}`,
  }
}
