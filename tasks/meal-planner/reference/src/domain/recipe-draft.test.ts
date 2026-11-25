import { describe, expect, it } from "vitest"
import { parseQuantity, quantityText } from "./quantity.ts"
import { emptyDraft, moved, parseDraft, readDraft } from "./recipe-draft.ts"

const catalog = new Map([["flour", { id: "flour", name: "All-purpose flour", names: { es: "Harina de trigo" }, aisle: "Baking" }]])

describe("calories", () => {
  it("are optional, but must be a whole number when given", () => {
    const draft = { ...emptyDraft(), title: "T", minutes: "10", lines: [{ key: "a", quantity: "1", unit: "cup" as const, ingredient: "flour", note: "" }], steps: [{ key: "s", text: "Mix." }] }
    const without = readDraft(draft, catalog)
    expect("recipe" in without && without.recipe.caloriesPerServing).toBeUndefined()
    expect("errors" in readDraft({ ...draft, calories: "abc" }, catalog)).toBe(true)
  })
})

describe("parseQuantity", () => {
  it.each([["2", 2], ["0.5", 0.5], [".5", 0.5], ["1,5", 1.5], ["1/2", 0.5], ["1 1/2", 1.5], ["1½", 1.5], ["1 ½", 1.5], ["", null]])("reads %j", (text, value) => {
    expect(parseQuantity(text)).toBe(value)
  })

  it("reads a whole number and a fraction only with a space between", () => {
    expect(parseQuantity("11/2")).toBe(5.5)
    expect(parseQuantity("10/3")).toBeCloseTo(3.333)
  })

  it.each(["abc", "-1", "1/0", "1..2", "1.5/2", "0x10"])("refuses %j", (text) => {
    expect(parseQuantity(text)).toBeNaN()
  })
})

describe("quantityText", () => {
  it.each([[1 / 3, "⅓"], [4 / 3, "1 ⅓"], [1.5, "1 ½"], [175, "175"], [0.125, "⅛"], [12.7, "12.7"]])("writes %s as %j and reads it back", (value, text) => {
    expect(quantityText(value)).toBe(text)
    expect(parseQuantity(text)).toBeCloseTo(value)
  })
})

describe("readDraft", () => {
  it("takes only plain whole numbers for servings, time and calories", () => {
    const draft = { ...emptyDraft(), title: "T", servings: "0x10", minutes: "1e1", calories: "200" }
    const result = readDraft(draft, catalog)
    expect("errors" in result && Object.keys(result.errors)).toEqual(expect.arrayContaining(["servings", "minutes"]))
  })

  it("names every field that is wrong", () => {
    const draft = { ...emptyDraft(), servings: "2.5", steps: [] }
    const result = readDraft(draft, catalog)
    expect("errors" in result && Object.keys(result.errors).sort()).toEqual([`lines.${draft.lines[0]!.key}`, "minutes", "servings", "steps", "title"].sort())
  })

  it("builds a recipe and matches ingredients of the catalog by name", () => {
    const draft = emptyDraft()
    const result = readDraft({
      ...draft,
      title: " Bread ",
      minutes: "60",
      calories: "250",
      lines: [{ ...draft.lines[0]!, quantity: "1 ½", unit: "cup", ingredient: "all-purpose FLOUR" }, { key: "x", quantity: "", unit: "", ingredient: "Sea salt", note: "" }, { key: "y", quantity: "200", unit: "g", ingredient: "harina de trigo", note: "" }],
      steps: [{ key: "s", text: "Bake." }],
    }, catalog)
    expect("recipe" in result && result.recipe).toMatchObject({ title: "Bread", servings: 4, ingredients: [{ ingredient: "flour", quantity: 1.5, unit: "cup" }, { name: "Sea salt", quantity: null, unit: null }, { ingredient: "flour", quantity: 200, unit: "g" }] })
  })
})

describe("moved", () => {
  it("moves an item and stays put at the ends", () => {
    expect(moved(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"])
    expect(moved(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"])
  })
})

describe("parseDraft", () => {
  it("reads back a kept draft and refuses one of the wrong shape", () => {
    const draft = { ...emptyDraft(), title: "Half done" }
    expect(parseDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft)
    expect(parseDraft({ ...draft, lines: [{ key: 1 }] })).toBeNull()
    expect(parseDraft("{not json")).toBeNull()
  })
})
