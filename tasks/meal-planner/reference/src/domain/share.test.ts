import { describe, expect, it } from "vitest"
import { decodeWeek, encodeWeek, ShareError, type SharedWeek, sharedEntries, shareWeek } from "./share.ts"
import { meals, type Recipe } from "./types.ts"

const custom: Recipe = { id: "custom-abc", title: "Grandma's soup", description: "", cuisine: "Other", course: "soup", diets: [], minutes: 40, servings: 4, caloriesPerServing: 300, createdAt: "2026-11-01", ingredients: [{ ingredient: "carrot", quantity: 2, unit: "piece" }, { name: "Love", quantity: null, unit: null }], steps: ["Simmer."], custom: true }
const full: SharedWeek = {
  week: "2026-11-09",
  meals: Array.from({ length: 21 }, (_, at) => ({ day: Math.floor(at / 3), meal: meals[at % 3]!, recipeId: String(20_000 + at * 13), eaters: 2 })),
  recipes: [],
}

describe("share links", () => {
  it("round-trips a week, custom recipes included", async () => {
    const week = { ...full, meals: [...full.meals, { day: 6, meal: "dinner" as const, recipeId: custom.id, eaters: 3 }], recipes: [custom] }
    expect(await decodeWeek(await encodeWeek(week))).toEqual(week)
  })

  it("keeps a full week of built-in meals short enough for a chat", async () => {
    const text = await encodeWeek(full)
    expect(text).toMatch(/^[\w-]+$/)
    expect(text.length).toBeLessThan(400)
  })

  it("refuses a garbled or cut link with a ShareError", async () => {
    const text = await encodeWeek(full)
    await expect(decodeWeek(text.slice(0, -10))).rejects.toBeInstanceOf(ShareError)
    await expect(decodeWeek("not a link!")).rejects.toBeInstanceOf(ShareError)
    await expect(decodeWeek("")).rejects.toBeInstanceOf(ShareError)
  })
})

describe("decoding untrusted links", () => {
  it("refuses a link that redefines a built-in recipe", async () => {
    const evil = { ...custom, id: "123", title: "EVIL" }
    const { custom: _drop, ...builtIn } = evil
    const text = await encodeWeek({ ...full, recipes: [builtIn as Recipe] })
    await expect(decodeWeek(text)).rejects.toBeInstanceOf(ShareError)
  })

  it("refuses a meal that names a custom recipe the link doesn't carry", async () => {
    const text = await encodeWeek({ ...full, meals: [{ day: 0, meal: "dinner", recipeId: "custom-missing", eaters: 2 }] })
    await expect(decodeWeek(text)).rejects.toBeInstanceOf(ShareError)
  })
})

describe("shareWeek and sharedEntries", () => {
  const people = [{ id: "a", name: "Ana", diets: [], allergies: [] }, { id: "b", name: "Bo", diets: [], allergies: [] }]
  const entries = [
    { id: "1", date: "2026-11-10", meal: "dinner" as const, recipeId: "68", eaters: null },
    { id: "2", date: "2026-11-15", meal: "lunch" as const, recipeId: custom.id, eaters: ["a"] },
    { id: "3", date: "2026-11-17", meal: "lunch" as const, recipeId: "13", eaters: null },
  ]

  it("carries the week's meals, who eats them, and the custom recipes they use", () => {
    expect(shareWeek("2026-11-09", entries, people, { servings: () => 4, custom: [custom, { ...custom, id: "custom-other" }] })).toEqual({
      week: "2026-11-09",
      meals: [{ day: 1, meal: "dinner", recipeId: "68", eaters: 2 }, { day: 6, meal: "lunch", recipeId: custom.id, eaters: 1 }],
      recipes: [custom],
    })
  })

  it("turns a shared week back into plan entries for everyone at the receiver's table", () => {
    const shared = shareWeek("2026-11-09", entries, people, { servings: () => 4, custom: [custom] })
    expect(sharedEntries(shared)).toEqual([
      { date: "2026-11-10", meal: "dinner", recipeId: "68", eaters: null },
      { date: "2026-11-15", meal: "lunch", recipeId: custom.id, eaters: null },
    ])
  })
})
