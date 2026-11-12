// Amounts as people type them and as the app writes them back for editing.
import { fractionGlyphs, fractionParts } from "./format.ts"

/** `2`, `0.5`, `.5`, `1,5`, `1/2`, `1 1/2`, `1½`, `1 ½` as a number; `""` as null (to taste); anything else as NaN. */
export function parseQuantity(text: string): number | null {
  const value = text.trim().replace(",", ".")
  if (!value) return null
  if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return Number(value)
  // A whole number before a fraction needs a space (`1 1/2`), so `11/2` stays eleven halves.
  const fraction = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(value)
  if (fraction) return Number(fraction[3]) ? Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3]) : Number.NaN
  const glyph = /^(?:(\d+)\s*)?([⅛¼⅓½⅔¾])$/.exec(value)
  if (glyph) return Number(glyph[1] ?? 0) + (fractionGlyphs.get(glyph[2] ?? "") ?? Number.NaN)
  return Number.NaN
}

/** The way the form writes an amount back: `1 ⅓` for a cooking fraction, so editing never drifts to 0.333. */
export function quantityText(quantity: number): string {
  const { whole, glyph, exact } = fractionParts(quantity)
  if (!exact || !glyph) return String(Math.round(quantity * 1000) / 1000)
  return whole ? `${whole} ${glyph}` : glyph
}
