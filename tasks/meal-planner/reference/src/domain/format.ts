import type { Language } from "./types.ts"
import type { Amount, Unit } from "./units.ts"

/** The words amounts need in one language, from its message catalog: unit names and the names of counted things. */
export interface Wording {
  language: Language
  /** Singular and plural of each unit: `["cup", "cups"]`, `["g", "g"]`. */
  units: Readonly<Record<Unit, readonly [string, string]>>
  /** Singular and plural of the ingredients counted in pieces, by ingredient id: `["Egg", "Eggs"]`. */
  counted: Readonly<Record<string, readonly [string, string]>>
}

const fractions: [number, string][] = [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"], [1, ""]]

/** The nearest cooking fraction: `1.48` → 1.5, `0.34` → ⅓. A positive amount never rounds down to nothing: it becomes ⅛. */
export function roundToFraction(value: number): number {
  const whole = Math.floor(value)
  const [part] = fractions.reduce((best, entry) => Math.abs(entry[0] - (value - whole)) < Math.abs(best[0] - (value - whole)) ? entry : best)
  return whole + part || (value > 0 ? 1 / 8 : 0)
}

/** Each fraction glyph and its value: `½` → 0.5. */
export const fractionGlyphs: ReadonlyMap<string, number> = new Map(fractions.filter(([, glyph]) => glyph).map(([part, glyph]) => [glyph, part]))

/**
 * A value as a whole number and a fraction glyph, rounded to the nearest cooking fraction. `exact` says whether the value
 * already was one, as a recipe's ⅓ cup is.
 */
export function fractionParts(value: number): { whole: number, glyph: string, exact: boolean } {
  const rounded = roundToFraction(value)
  const whole = Math.floor(rounded + 1e-9)
  const glyph = fractions.find(([part]) => Math.abs(part - (rounded - whole)) < 1e-9)?.[1] ?? ""
  return { whole, glyph, exact: Math.abs(rounded - value) < 1e-6 }
}

/** A value already rounded to a cooking fraction, written out: `1 ½`, `⅓`. */
function writeFraction(rounded: number, locale?: string): string {
  const { whole, glyph } = fractionParts(rounded)
  if (!whole) return glyph || "0"
  return [new Intl.NumberFormat(locale).format(whole), glyph].filter(Boolean).join(" ")
}

/**
 * The number a cook reads: whole grams and milliliters, up to two decimals of kilograms and liters, and cooking
 * fractions for everything else. The text and the unit's plural both come from it, so they never disagree.
 */
export function roundAmount({ value, unit }: Amount): number {
  if (unit === "g" || unit === "ml") return Math.max(1, Math.round(value))
  if (unit === "kg" || unit === "l") return Math.round(value * 100) / 100
  return roundToFraction(value)
}

export function formatValue(amount: Amount, locale?: string): string {
  const rounded = roundAmount(amount)
  if (["g", "ml", "kg", "l"].includes(amount.unit)) return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(rounded)
  return writeFraction(rounded, locale)
}

/**
 * Whether an amount reads as plural. Cookbooks write "½ cup" and "1 cup" but "1 ½ cups" (in Spanish too: "½ taza",
 * "1 ½ tazas"), so anything up to one is singular. Intl.PluralRules would call 0.5 "other" in English.
 */
export function isPlural(amount: Amount): boolean {
  return roundAmount(amount) > 1
}

/** `2 cups`, `200 g`, `1,5 kg`. Pieces have no unit word: the ingredient's own name carries the count. */
export function formatAmount(amount: Amount, wording: Wording): string {
  const value = formatValue(amount, wording.language)
  return amount.unit === "piece" ? value : `${value} ${wording.units[amount.unit][isPlural(amount) ? 1 : 0]}`
}
