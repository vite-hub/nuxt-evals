import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryHistory, createRouter } from "vue-router"
import { useRecipes } from "../composables/recipes"
import { routes } from "../router"
import { catalog } from "../test/catalog"

async function mountForm() {
  // The form waits for the ingredients catalog, which the app fetches; here it comes from the data folder.
  useRecipes().catalog.value = catalog
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push("/en/recipes/new")
  const wrapper = mount({ template: "<RouterView />" }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("the recipe form", () => {
  it("refuses an empty recipe, shows why next to each field, and focuses the first", async () => {
    const { wrapper } = await mountForm()
    await wrapper.find("form").trigger("submit")
    await flushPromises()
    expect(wrapper.find("#title-error").text()).toBe("Give the recipe a title.")
    expect(wrapper.find("#minutes-error").exists()).toBe(true)
    expect(document.activeElement?.id).toBe("field-title")
    expect(useRecipes().custom.value).toHaveLength(0)
  })

  it("saves a valid recipe and opens it", async () => {
    const { wrapper, router } = await mountForm()
    await wrapper.find("#field-title").setValue("Garlic toast")
    await wrapper.find("#field-minutes").setValue("10")
    await wrapper.find("#field-calories").setValue("180")
    const line = wrapper.find(".line")
    await line.findAll("input")[0]!.setValue("2")
    await line.find("select").setValue("clove")
    await line.findAll("input")[1]!.setValue("Garlic")
    await wrapper.find(".step textarea").setValue("Toast the bread and rub it with garlic.")
    await wrapper.find("form").trigger("submit")
    await flushPromises()
    const saved = useRecipes().custom.value[0]
    expect(saved).toMatchObject({ title: "Garlic toast", custom: true, ingredients: [{ ingredient: "garlic", quantity: 2, unit: "clove" }] })
    await vi.waitFor(() => expect(router.currentRoute.value.params.id).toBe(saved?.id))
  })

  it("keeps each ingredient row's values when rows move", async () => {
    const { wrapper } = await mountForm()
    await wrapper.find(".line").findAll("input")[1]!.setValue("Flour")
    await wrapper.findAll("button").find(button => button.text() === "Add an ingredient")!.trigger("click")
    await wrapper.findAll(".line")[1]!.findAll("input")[1]!.setValue("Sugar")
    await wrapper.find("[aria-label='Move ingredient 2 up']").trigger("click")
    expect(wrapper.findAll(".line").map(row => (row.findAll("input")[1]!.element as HTMLInputElement).value)).toEqual(["Sugar", "Flour"])
  })
})

describe("reordering rows by keyboard", () => {
  it("keeps focus on the pressed button as its row moves, and on a neighbour after a removal", async () => {
    const { wrapper } = await mountForm()
    const add = wrapper.find("[data-add='lines']")
    await add.trigger("click")
    await add.trigger("click")
    const rows = wrapper.findAll(".line")
    const third = rows[2]!.attributes("data-row")
    await rows[2]!.find("[data-action='up']").trigger("click")
    await flushPromises()
    expect(document.activeElement?.closest("[data-row]")?.getAttribute("data-row")).toBe(third)
    expect(document.activeElement?.getAttribute("data-action")).toBe("up")

    const first = wrapper.findAll(".line")[0]!
    const second = wrapper.findAll(".line")[1]!.attributes("data-row")
    await first.find("[data-action='remove']").trigger("click")
    await flushPromises()
    expect(document.activeElement?.closest("[data-row]")?.getAttribute("data-row")).toBe(second)
  })
})
