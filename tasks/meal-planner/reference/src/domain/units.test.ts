import { describe, expect, it } from "vitest"
import { wordingEn } from "../test/wording"
import { formatAmount, formatValue } from "./format.ts"
import { addBaseAmounts, combineAmounts, convertTo, displayAmount, toBase, toGrams } from "./units.ts"

const show = (quantity: number, unit: Parameters<typeof toBase>[1], system: "metric" | "us") => formatAmount(displayAmount(toBase(quantity, unit), system), wordingEn)

describe("cooking fractions", () => {
  it.each([
    [1.5, "1 ½"],
    [1 / 3, "⅓"],
    [0.333, "⅓"],
    [4 / 3, "1 ⅓"],
    [8 / 3, "2 ⅔"],
    [0.75, "¾"],
    [2, "2"],
    [0.97, "1"],
    [0.01, "⅛"],
  ])("%s reads %s", (value, text) => {
    expect(formatValue({ value, unit: "cup" }, "en")).toBe(text)
  })
})

describe("display units", () => {
  it("keeps grams and milliliters whole and switches to kg and l", () => {
    expect(show(175, "g", "metric")).toBe("175 g")
    expect(show(1500, "g", "metric")).toBe("1.5 kg")
    expect(show(1.2, "l", "metric")).toBe("1.2 l")
    expect(show(0.1 + 0.2, "kg", "metric")).toBe("300 g")
  })

  it("converts cups to milliliters in metric with the US cup", () => {
    expect(show(1, "cup", "metric")).toBe("237 ml")
    expect(show(4 / 3, "cup", "metric")).toBe("315 ml")
  })

  it("keeps small spoon measures as spoons in metric", () => {
    expect(show(2, "tsp", "metric")).toBe("2 tsp")
    expect(show(4, "tbsp", "metric")).toBe("4 tbsp")
    expect(show(12, "tbsp", "metric")).toBe("177 ml")
  })

  it("picks tsp, tbsp or cups in US units", () => {
    expect(show(200, "ml", "us")).toBe("¾ cup")
    expect(show(10, "ml", "us")).toBe("2 tsp")
    expect(show(30, "ml", "us")).toBe("2 tbsp")
    expect(show(12, "tbsp", "us")).toBe("¾ cup")
    expect(show(1.5, "cup", "us")).toBe("1 ½ cups")
  })

  it("picks oz or lb in US units", () => {
    expect(show(175, "g", "us")).toBe("6 ⅛ oz")
    expect(show(680, "g", "us")).toBe("1 ½ lb")
  })

  it("names counts in the right number", () => {
    expect(show(1, "clove", "metric")).toBe("1 clove")
    expect(show(3, "clove", "metric")).toBe("3 cloves")
    expect(show(0.5, "cup", "us")).toBe("½ cup")
    expect(show(1, "cup", "us")).toBe("1 cup")
    expect(show(2, "can", "us")).toBe("2 cans")
    expect(show(1.5, "piece", "us")).toBe("1 ½")
  })

  it("rounds before it picks the unit", () => {
    expect(show(999.6, "g", "metric")).toBe("1 kg")
    expect(show(453, "g", "us")).toBe("1 lb")
    expect(show(14.7, "ml", "us")).toBe("1 tbsp")
    expect(show(999.7, "ml", "metric")).toBe("1 l")
  })

  it("picks the plural from the number shown, not the raw value", () => {
    expect(show(250, "ml", "us")).toBe("1 cup")
    expect(show(1.04, "clove", "metric")).toBe("1 clove")
    expect(show(1.1, "cup", "us")).toBe("1 ⅛ cups")
    expect(show(0.98, "can", "us")).toBe("1 can")
  })
})

describe("addBaseAmounts", () => {
  it("adds within a kind and keeps kinds apart", () => {
    const sum = addBaseAmounts([toBase(175, "g"), toBase(0.5, "kg"), toBase(1.75, "cup"), toBase(1, "pinch"), toBase(2, "piece")])
    expect(sum.map(amount => [amount.dimension, Math.round(amount.value)])).toEqual([["mass", 675], ["volume", 414], ["piece", 2], ["pinch", 1]])
  })
})

describe("weights", () => {
  const flour = { gramsPerCup: 125 }
  const egg = { gramsPerCup: 243, gramsPerPiece: 50 }

  it("turns volumes and pieces into grams with the data's density and piece weight", () => {
    expect(toGrams(toBase(1, "cup"), flour)).toBeCloseTo(125)
    expect(toGrams(toBase(1, "tbsp"), flour)).toBeCloseTo(7.81, 1)
    expect(toGrams(toBase(3, "piece"), egg)).toBe(150)
    expect(toGrams(toBase(3, "piece"), flour)).toBeNull()
    expect(toGrams(toBase(1, "pinch"), egg)).toBeNull()
  })

  it("converts between kinds through grams", () => {
    expect(convertTo(toBase(1, "cup"), "mass", flour)).toBeCloseTo(125)
    expect(convertTo(toBase(100, "g"), "piece", egg)).toBe(2)
    expect(convertTo(toBase(1, "cup"), "piece", flour)).toBeNull()
  })

  it("adds what it can weigh into one total and keeps the rest apart", () => {
    expect(combineAmounts([toBase(175, "g"), toBase(0.875, "cup")], flour).map(amount => [amount.dimension, Math.round(amount.value)])).toEqual([["mass", 284]])
    expect(combineAmounts([toBase(2, "piece"), toBase(1, "cup")], { gramsPerPiece: 150 }).map(amount => amount.dimension)).toEqual(["volume", "piece"])
    expect(combineAmounts([toBase(2, "piece"), toBase(3, "piece")], egg).map(amount => [amount.dimension, amount.value])).toEqual([["piece", 5]])
  })
})
