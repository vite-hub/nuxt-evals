import { describe, expect, it } from "vitest"
import { nextTick } from "vue"
import { usePlan } from "./plan"

describe("usePlan", () => {
  it("undoes and redoes, and starts the history over when the plan changes from elsewhere", async () => {
    const { plan, add, undo, redo, canUndo } = usePlan()
    add("1", { date: "2026-11-09", meal: "dinner" })
    add("2", { date: "2026-11-10", meal: "lunch" })
    await nextTick()
    expect(undo()).toBe(true)
    expect(plan.value.map(entry => entry.recipeId)).toEqual(["1"])
    expect(redo()).toBe(true)
    expect(plan.value).toHaveLength(2)
    // Another tab, or an import, replaces the plan: this tab's history can't undo past that.
    plan.value = []
    await nextTick()
    expect(canUndo.value).toBe(false)
    expect(undo()).toBe(false)
  })

})
