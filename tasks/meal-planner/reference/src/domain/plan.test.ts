import { describe, expect, it } from "vitest"
import { addToPlan, caloriesPerPerson, copyIntoWeek, entriesOf, entriesOn, removeFromPlan, updateInPlan } from "./plan.ts"
import type { PlanEntry } from "./types.ts"

const entry = (id: string, date: string, recipeId = "1"): PlanEntry => ({ id, date, meal: "dinner", recipeId, eaters: null })
const plan = [entry("a", "2026-11-09"), entry("b", "2026-11-10", "2"), entry("c", "2026-11-17")]

describe("the plan", () => {
  it("changes by returning a new list, never in place", () => {
    const added = addToPlan(plan, entry("d", "2026-11-11"))
    expect(added).toHaveLength(4)
    expect(plan).toHaveLength(3)
    expect(updateInPlan(plan, "b", { meal: "lunch", eaters: ["x"] })[1]).toEqual({ ...plan[1], meal: "lunch", eaters: ["x"] })
    expect(removeFromPlan(plan, ["a", "c"]).map(item => item.id)).toEqual(["b"])
  })

  it("finds a week's meals and adds their calories per person", () => {
    const week = entriesOn(plan, ["2026-11-09", "2026-11-10"])
    expect(week.map(item => item.id)).toEqual(["a", "b"])
    expect(caloriesPerPerson(week, id => ({ 1: 400, 2: 250 })[id])).toBe(650)
    expect(caloriesPerPerson([entry("x", "2026-11-09", "unknown")], () => undefined)).toBe(0)
    expect(entriesOf(plan, "1").map(item => item.id)).toEqual(["a", "c"])
  })

  it("copies a week next to the meals there, or instead of them", () => {
    const days = ["2026-11-09", "2026-11-10"]
    const incoming = [entry("n", "2026-11-09", "9")]
    expect(copyIntoWeek(plan, days, incoming, "merge").map(item => item.id)).toEqual(["a", "b", "c", "n"])
    expect(copyIntoWeek(plan, days, incoming, "replace").map(item => item.id)).toEqual(["c", "n"])
  })
})
