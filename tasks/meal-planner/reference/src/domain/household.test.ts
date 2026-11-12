import { describe, expect, it } from "vitest"
import { eatersFrom, eatersOf, portions } from "./household.ts"
import type { PlanEntry, Person } from "./types.ts"

const people: Person[] = ["a", "b", "c"].map(id => ({ id, name: id.toUpperCase(), diets: [], allergies: [] }))
const entry = (eaters: string[] | null): PlanEntry => ({ id: "e", date: "2026-11-09", meal: "dinner", recipeId: "1", eaters })

describe("household", () => {
  it("has everyone eat by default, and only the people still in the household otherwise", () => {
    expect(eatersOf(entry(null), people).map(person => person.id)).toEqual(["a", "b", "c"])
    expect(eatersOf(entry(["b", "gone"]), people).map(person => person.id)).toEqual(["b"])
  })

  it("makes one portion per eater, or the recipe as written without a household", () => {
    expect(portions(entry(["a", "c"]), people, { servings: 4 })).toBe(2)
    expect(portions(entry(null), [], { servings: 4 })).toBe(4)
  })

  it("is everyone again when all are ticked", () => {
    expect(eatersFrom(["c", "a"], people)).toEqual(["a", "c"])
    expect(eatersFrom(["a", "b", "c"], people)).toBeNull()
    expect(eatersFrom([], people)).toEqual([])
  })
})
