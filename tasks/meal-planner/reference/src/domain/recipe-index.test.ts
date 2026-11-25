import { describe, expect, it } from "vitest"
import { dataRecipes } from "../test/catalog"
import { buildIndex, type ListFilters, mergeResults, parseIndex, type RecipeSummary, searchIndex, summaryAt } from "./recipe-index.ts"
import { foldText } from "./text.ts"
import type { Language } from "./types.ts"

const index = buildIndex(dataRecipes())
const all: ListFilters = { q: "", diets: [], cuisine: null, maxMinutes: null, sort: "rating" }
const titles = (filters: Partial<ListFilters>, language: Language = "en") => searchIndex(index, { ...all, ...filters }, language).map(at => index.titles[at])

describe("foldText", () => {
  it("drops accents and folds letters NFD keeps whole", () => {
    expect(foldText("Crème Brûlée")).toBe("creme brulee")
    expect(foldText("Smørrebrød")).toBe("smorrebrod")
    expect(foldText("Œufs")).toBe("oeufs")
    expect(foldText("Çılbır")).toBe("cilbir")
  })
})

describe("the list index", () => {
  it("survives its own check, and the check refuses a broken one", () => {
    expect(parseIndex(JSON.parse(JSON.stringify(index)))).not.toBeNull()
    expect(parseIndex({ ...index, minutes: index.minutes.slice(1) })).toBeNull()
  })

  it.each([["creme brulee", "Crème Brûlée"], ["CEVAPI", "Ćevapi"], ["oeufs", "Œufs en Cocotte"], ["smorrebrod", "Smørrebrød"], ["cilbir", "Çılbır"]])("finds %s", (q, title) => {
    expect(titles({ q })).toContain(title)
  })

  it("combines filters: vegan, Thai, at most 30 minutes", () => {
    expect(titles({ diets: ["vegan"], cuisine: "Thai", maxMinutes: 30 })).toHaveLength(177)
  })

  it("sorts names by the language", () => {
    const en = titles({ sort: "name" })
    const cevapi = en.indexOf("Ćevapi")
    expect(en[cevapi + 1]![0]).toBe("C")
    expect(["B", "C"]).toContain(en[cevapi - 1]![0])
    const es = titles({ sort: "name" }, "es")
    const noquis = es.indexOf("Ñoquis de Papa")
    expect(es.slice(0, noquis).some(title => title!.startsWith("O"))).toBe(false)
    expect(es.slice(noquis).some(title => title!.startsWith("N"))).toBe(false)
    // The data has no other title that starts with N, so in English too it comes right before the O's.
    expect(en[en.indexOf("Ñoquis de Papa") + 1]![0]).toMatch(/[OŒ]/)
  })

  it("merges custom recipes into the order", () => {
    const found = searchIndex(index, { ...all, sort: "time" }, "en")
    const mine: RecipeSummary = { ...summaryAt(index, found[10]!), id: "custom-x", title: "Mine", custom: true }
    const merged = mergeResults(index, found, [mine], "time", "en")
    expect(merged).toHaveLength(found.length + 1)
    expect(merged.indexOf(mine)).toBeLessThanOrEqual(11)
  })
})
