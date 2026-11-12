import { describe, expect, it } from "vitest"
import { parseExport, toExport, type UserData } from "./schema.ts"
import type { Recipe } from "./types.ts"

const custom: Recipe = { id: "custom-1", title: "Soup", description: "", cuisine: "Other", course: "soup", diets: [], minutes: 20, servings: 2, caloriesPerServing: 200, createdAt: "2026-11-01", ingredients: [{ name: "Water", quantity: 1, unit: "l" }], steps: ["Boil."], custom: true }
const data: UserData = {
  plan: [{ id: "a", date: "2026-11-09", meal: "dinner", recipeId: "custom-1", eaters: null }, { id: "b", date: "2026-11-10", meal: "lunch", recipeId: "7", eaters: ["p1"] }],
  people: [{ id: "p1", name: "Ana", diets: ["vegan"], allergies: ["peanuts"] }],
  recipes: [custom],
  shopping: { ticked: { "2026-11-09": ["water"] } },
  pantry: { flour: { quantity: 100, unit: "g" } },
  settings: { units: "us", colorMode: "dark", language: "es" },
}

describe("export files", () => {
  it("round-trips everything that belongs to the user", () => {
    expect(parseExport(toExport(data))).toEqual({ ok: true, data })
  })

  it("names why it refuses what isn't an export", () => {
    expect(parseExport("{not json")).toEqual({ ok: false, error: "not-json" })
    expect(parseExport(JSON.stringify({ hello: "world" }))).toEqual({ ok: false, error: "not-export" })
    expect(parseExport(JSON.stringify({ ...JSON.parse(toExport(data)), version: 99 }))).toEqual({ ok: false, error: "version" })
  })

  it("refuses a file with one bad item", () => {
    const file = JSON.parse(toExport(data))
    file.people[0].allergies = ["kryptonite"]
    expect(parseExport(JSON.stringify(file))).toEqual({ ok: false, error: "damaged" })
  })

  it("drops prototype keys", () => {
    const text = toExport(data).replace("\"plan\":", "\"__proto__\": { \"polluted\": true }, \"plan\":")
    expect(parseExport(text).ok).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
