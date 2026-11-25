import type { Language } from "../domain/types"

const rules = new Map<Language, Intl.PluralRules>()

/** `1 recipe`, `2 recipes`, `1 receta`: the count, in the language's digits, with the form its plural rules pick. */
export function count(language: Language, n: number, one: string, other: string): string {
  let pluralRules = rules.get(language)
  if (!pluralRules) rules.set(language, pluralRules = new Intl.PluralRules(language))
  return `${new Intl.NumberFormat(language).format(n)} ${pluralRules.select(n) === "one" ? one : other}`
}
