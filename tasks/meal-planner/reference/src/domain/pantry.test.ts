import { describe, expect, it } from "vitest"
import { addStock } from "./pantry.ts"

describe("addStock", () => {
  it("starts an item, and adds in the unit the pantry already uses", () => {
    expect(addStock(undefined, { quantity: 6, unit: "piece" }, {})).toEqual({ quantity: 6, unit: "piece" })
    expect(addStock({ quantity: 500, unit: "g" }, { quantity: 0.5, unit: "kg" }, {})).toEqual({ quantity: 1000, unit: "g" })
  })

  it("converts through the density or the piece weight", () => {
    expect(addStock({ quantity: 500, unit: "g" }, { quantity: 1, unit: "cup" }, { gramsPerCup: 125 })?.quantity).toBeCloseTo(625)
    expect(addStock({ quantity: 6, unit: "piece" }, { quantity: 100, unit: "g" }, { gramsPerPiece: 50 })).toEqual({ quantity: 8, unit: "piece" })
  })

  it("can't add what the data can't weigh", () => {
    expect(addStock({ quantity: 2, unit: "piece" }, { quantity: 1, unit: "cup" }, { gramsPerPiece: 150 })).toBeNull()
  })
})
