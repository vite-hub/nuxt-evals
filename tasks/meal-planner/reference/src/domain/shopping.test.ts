import { describe, expect, it } from "vitest"
import { catalog, recipeById } from "../test/catalog"
import { wordingEn } from "../test/wording"
import { aisleOrder, displayItem, isCovered, type ShoppingItem, shoppingList, subtractPantry } from "./shopping.ts"
import type { Pantry, PlanEntry, Person, Recipe } from "./types.ts"

const two: Person[] = [{ id: "a", name: "Ana", diets: [], allergies: [] }, { id: "b", name: "Bo", diets: [], allergies: [] }]
const entry = (recipeId: string, eaters: string[] | null = null): PlanEntry => ({ id: `${recipeId}-${Math.random()}`, date: "2026-11-09", meal: "dinner", recipeId, eaters })
const list = (recipes: Recipe[], people: Person[], pantry: Pantry = {}, entries = recipes.map(recipe => entry(recipe.id))) =>
  shoppingList(entries, new Map(recipes.map(recipe => [recipe.id, recipe])), catalog, people, pantry, "en")
const item = (aisles: ReturnType<typeof list>, key: string): ShoppingItem => aisles.flatMap(aisle => aisle.items).find(found => found.key === key)!
const shown = (found: ShoppingItem) => displayItem(found, "metric", wordingEn)

describe("shoppingList", () => {
  const galette = recipeById(68)
  const brownies = recipeById(13)

  it("adds grams and cups of flour through the density, for the people eating", () => {
    // 175 g for 8 → 43.75 g for 2; 1 ¾ cups for 4 → 0.875 cups × 125 g = 109.4 g for 2.
    const flour = item(list([galette, brownies], two), "flour")
    expect(flour.needed).toHaveLength(1)
    expect(flour.apart).toBe(false)
    expect(shown(flour).missing).toEqual(["153 g"])
  })

  it("scales by who eats each meal", () => {
    const flour = item(list([galette], two, {}, [entry("68", ["a"])]), "flour")
    expect(shown(flour).missing).toEqual(["22 g"])
  })

  it("plans recipes as written when there is no household", () => {
    expect(shown(item(list([galette], []), "flour")).missing).toEqual(["175 g"])
  })

  it("takes the pantry off, converting its unit", () => {
    expect(shown(item(list([galette, brownies], two, { flour: { quantity: 100, unit: "g" } }), "flour")).missing).toEqual(["53 g"])
    const cup = item(list([galette, brownies], two, { flour: { quantity: 1, unit: "cup" } }), "flour")
    expect(shown(cup).missing).toEqual(["28 g"])
    expect(isCovered(item(list([galette, brownies], two, { flour: { quantity: 1, unit: "kg" } }), "flour"))).toBe(true)
  })

  it("adds pieces with grams through the piece weight, and keeps them apart without one", () => {
    const tomatoes: Recipe = { ...galette, id: "custom-t", ingredients: [{ ingredient: "tomato", quantity: 2, unit: "piece" }, { ingredient: "tomato", quantity: 100, unit: "g" }, { ingredient: "onion", quantity: 1, unit: "piece" }, { ingredient: "onion", quantity: 1, unit: "cup" }], servings: 2 }
    const aisles = list([tomatoes], two)
    expect(shown(item(aisles, "tomato")).missing).toEqual(["340 g"])
    const onion = item(aisles, "onion")
    expect(onion.apart).toBe(true)
    expect(onion.needed.map(amount => amount.dimension).sort()).toEqual(["piece", "volume"])
  })

  it("lists to-taste ingredients once without a number, and adds pinches as a count", () => {
    const salty: Recipe = { ...galette, id: "custom-s", servings: 2, ingredients: [{ ingredient: "salt", quantity: null, unit: null }, { ingredient: "salt", quantity: 1, unit: "pinch" }, { ingredient: "salt", quantity: 2, unit: "pinch" }] }
    const salt = item(list([salty], two), "salt")
    expect(salt.toTaste).toBe(true)
    expect(shown(salt).missing).toEqual(["3 pinches"])
  })

  it("covers counted items from the pantry", () => {
    const eggs: Recipe = { ...galette, id: "custom-e", servings: 2, ingredients: [{ ingredient: "egg", quantity: 3, unit: "piece" }] }
    expect(isCovered(item(list([eggs], two, { egg: { quantity: 6, unit: "piece" } }), "egg"))).toBe(true)
    expect(shown(item(list([eggs], two, { egg: { quantity: 2, unit: "piece" } }), "egg")).missing).toEqual(["1"])
  })

  it("groups by aisle in shop order and skips meals whose recipe is gone", () => {
    const names = list([galette, brownies], two).map(aisle => aisle.name)
    expect(names).toEqual([...names].sort((a, b) => aisleOrder.indexOf(a) - aisleOrder.indexOf(b)))
    expect(names).toContain("Baking")
    expect(shoppingList([entry("gone")], new Map(), catalog, two, {}, "en")).toEqual([])
  })
})

describe("subtractPantry", () => {
  it("takes what it can from each amount in turn", () => {
    expect(subtractPantry([{ dimension: "mass", value: 300 }], { dimension: "mass", value: 100 }, {})).toEqual([{ dimension: "mass", value: 200 }])
    expect(subtractPantry([{ dimension: "piece", value: 2 }], { dimension: "mass", value: 100 }, {})).toEqual([{ dimension: "piece", value: 2 }])
  })
})
