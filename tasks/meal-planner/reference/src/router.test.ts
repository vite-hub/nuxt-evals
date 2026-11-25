import { describe, expect, it } from "vitest"
import { legacyPath } from "./router"

describe("legacyPath", () => {
  it.each([
    ["#/recipe/123", "/recipes/123"],
    ["#/recipe/97", "/recipes/97"],
    ["#/plan", "/plan"],
    ["#/", "/"],
    ["#/something-else", "/something-else"],
  ])("maps %s to %s", (hash, path) => {
    expect(legacyPath(hash)).toBe(path)
  })

  it.each(["", "#", "#section"])("leaves %j alone", (hash) => {
    expect(legacyPath(hash)).toBeNull()
  })
})
