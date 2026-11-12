import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { createMemoryHistory, createRouter } from "vue-router"
import { usePlan } from "../composables/plan"
import { useRecipes } from "../composables/recipes"
import { routes } from "../router"

describe("the planner", () => {
  it("undoes and redoes from the keyboard, but not while typing in a field", async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push("/en/plan/2026-11-09")
    const wrapper = mount({ template: "<RouterView />" }, { global: { plugins: [router] }, attachTo: document.body })
    // The built-in recipes aren't fetched here; the planner only needs to know the data is in.
    useRecipes().status.value = "ready"
    useRecipes().saveRecipe({ id: "custom-soup", title: "Soup", description: "", cuisine: "Other", course: "soup", diets: [], minutes: 20, servings: 2, caloriesPerServing: 250, createdAt: "2026-11-01", ingredients: [{ name: "Water", quantity: 1, unit: "l" }], steps: ["Boil."], custom: true })
    const { plan, add } = usePlan()
    add("custom-soup", { date: "2026-11-10", meal: "lunch" })
    add("custom-soup", { date: "2026-11-11", meal: "dinner" })
    await flushPromises()
    expect(wrapper.text()).toContain("250 kcal per person")

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }))
    expect(plan.value).toHaveLength(1)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true }))
    expect(plan.value).toHaveLength(2)

    const search = wrapper.find<HTMLInputElement>("input[type='search']")
    search.element.focus()
    search.element.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }))
    expect(plan.value).toHaveLength(2)
    wrapper.unmount()
  })
})
