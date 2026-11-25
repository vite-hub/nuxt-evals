import { describe, expect, it } from "vitest"
import { dataRecipes } from "../test/catalog"
import { en } from "./en"
import { es } from "./es"

/** Every key of a catalog, nested ones as `a.b.c`. */
function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, item]) => typeof item === "object" && item !== null ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`])
}

describe("messages", () => {
  it("have the same keys in both languages", () => {
    // `cuisines` is filled for Spanish only: English shows the data's own names.
    expect(keys(es).filter(key => !key.startsWith("words.cuisines."))).toEqual(keys(en))
  })

  it("translate every cuisine in the data into Spanish", () => {
    const cuisines = new Set(dataRecipes().map(recipe => recipe.cuisine))
    expect([...cuisines].filter(cuisine => !es.words.cuisines[cuisine])).toEqual([])
  })

  it("use each language's plural rules", () => {
    expect(en.list.count(1)).toBe("1 recipe")
    expect(en.list.count(20289)).toBe("20,289 recipes")
    expect(es.list.count(1)).toBe("1 receta")
    expect(es.list.count(2)).toBe("2 recetas")
    expect(es.list.count(20289)).toBe("20.289 recetas")
  })
})
