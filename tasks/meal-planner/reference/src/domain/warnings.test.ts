import { describe, expect, it } from "vitest"
import { catalog, recipeById } from "../test/catalog"
import type { Person } from "./types.ts"
import { warningsFor } from "./warnings.ts"

const person = (name: string, diets: Person["diets"] = [], allergies: Person["allergies"] = []): Person => ({ id: name, name, diets, allergies })
const reasons = (lines: Parameters<typeof warningsFor>[0], people: Person[]) => warningsFor(lines, people, catalog).map(({ person: who, reason }) =>
  `${who.name}: ${reason.kind === "unknown" ? `unknown ${reason.name}` : `${reason.kind === "diet" ? reason.diet : reason.allergen} ${reason.ingredient.id}`}`)

describe("warningsFor", () => {
  it("names the person and the ingredient that breaks their diet or allergy", () => {
    const bites = recipeById(7).ingredients
    expect(reasons(bites, [person("Ana", [], ["peanuts"]), person("Bo", ["vegan"]), person("Cy")])).toEqual(["Ana: peanuts peanut-butter", "Bo: vegan honey"])
    expect(reasons(recipeById(75).ingredients, [person("Di", ["vegetarian"])])).toEqual(["Di: vegetarian fish-sauce"])
  })

  it("reads gluten and dairy from the ingredient fields", () => {
    expect(reasons([{ ingredient: "flour", quantity: 1, unit: "cup" }, { ingredient: "butter", quantity: 1, unit: "tbsp" }], [person("Ed", ["gluten-free", "dairy-free"])]))
      .toEqual(["Ed: gluten-free flour", "Ed: dairy-free butter"])
  })

  it("says a typed-in ingredient can't be checked, rather than calling it safe", () => {
    expect(reasons([{ name: "Mystery sauce", quantity: 1, unit: "tbsp" }], [person("Fay", [], ["soy"]), person("Gus")])).toEqual(["Fay: unknown Mystery sauce"])
  })
})
