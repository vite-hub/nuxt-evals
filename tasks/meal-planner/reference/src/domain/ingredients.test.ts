import { describe, expect, it } from "vitest"
import { catalog } from "../test/catalog"
import { wordingEn, wordingEs } from "../test/wording"
import { displayLine } from "./ingredients.ts"

describe("displayLine", () => {
  it("names counted pieces in agreement with the number shown, in both languages", () => {
    const egg = { ingredient: "egg", quantity: 2, unit: "piece" as const }
    expect(displayLine(egg, 0.52, "metric", catalog, wordingEn)).toEqual({ amount: "1", name: "Egg" })
    expect(displayLine(egg, 0.25, "metric", catalog, wordingEn)).toEqual({ amount: "½", name: "Egg" })
    expect(displayLine(egg, 1, "metric", catalog, wordingEn)).toEqual({ amount: "2", name: "Eggs" })
    expect(displayLine(egg, 1, "metric", catalog, wordingEs)).toEqual({ amount: "2", name: "Huevos" })
  })

  it("uses the Spanish names and units", () => {
    expect(displayLine({ ingredient: "flour", quantity: 1.5, unit: "kg" }, 1, "metric", catalog, wordingEs)).toEqual({ amount: "1,5 kg", name: "Harina de trigo" })
    expect(displayLine({ ingredient: "sugar", quantity: 2, unit: "cup" }, 1, "us", catalog, wordingEs)).toEqual({ amount: "2 tazas", name: catalog.get("sugar")!.names.es })
    expect(displayLine({ ingredient: "sugar", quantity: 1, unit: "cup" }, 1, "us", catalog, wordingEs).amount).toBe("1 taza")
  })

  it("shows to-taste lines without an amount", () => {
    expect(displayLine({ ingredient: "salt", quantity: null, unit: null }, 3, "us", catalog, wordingEn)).toEqual({ amount: null, name: "Salt" })
  })
})
