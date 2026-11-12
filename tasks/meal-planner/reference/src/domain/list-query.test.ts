import { describe, expect, it } from "vitest"
import { defaultListState, parseListQuery, sameQuery, toListQuery } from "./list-query.ts"

describe("list query", () => {
  it("reads a full query", () => {
    expect(parseListQuery({ q: "soup", diet: ["vegan", "gluten-free"], cuisine: "Thai", time: "30", sort: "time", page: "2" }, ["Thai"]))
      .toEqual({ q: "soup", diets: ["vegan", "gluten-free"], cuisine: "Thai", maxMinutes: 30, sort: "time", page: 2 })
  })

  it("falls back to defaults for values that mean nothing", () => {
    expect(parseListQuery({ time: "abc", diet: "fish", sort: "nope", page: "-3", cuisine: "Martian" }, ["Thai"])).toEqual(defaultListState)
  })

  it("writes only what differs from the defaults", () => {
    expect(toListQuery(defaultListState)).toEqual({})
    expect(toListQuery({ ...defaultListState, diets: ["vegan"], page: 3 })).toEqual({ diet: ["vegan"], page: "3" })
  })

  it("compares a URL query with a clean one", () => {
    expect(sameQuery({ diet: "vegan" }, { diet: ["vegan"] })).toBe(true)
    expect(sameQuery({ time: "abc" }, {})).toBe(false)
  })
})
