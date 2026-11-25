import type { Pantry } from "./types.ts"
import { convertTo, inUnit, toBase, type Weights } from "./units.ts"

type Stock = Pantry[string]

/**
 * What the pantry holds after adding `added` to `stock`, in the stock's unit: 500 g of flour plus 1 cup is 625 g.
 * Null when the two can't be added (no density or piece weight for the units), so the caller can ask what to keep.
 */
export function addStock(stock: Stock | undefined, added: Stock, weights: Weights): Stock | null {
  if (!stock) return added
  const base = convertTo(toBase(added.quantity, added.unit), toBase(1, stock.unit).dimension, weights)
  return base === null ? null : { quantity: stock.quantity + inUnit(base, stock.unit), unit: stock.unit }
}
