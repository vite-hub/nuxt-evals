import { describe, expect, it } from "vitest"
import { upsertById } from "./lists.ts"

const list = [{ id: "a", n: 1 }, { id: "b", n: 2 }]

describe("upsertById", () => {
  it("replaces the item with the same id, in its place", () => {
    expect(upsertById(list, { id: "b", n: 3 })).toEqual([{ id: "a", n: 1 }, { id: "b", n: 3 }])
  })

  it("adds a new item at the end, or at the start", () => {
    expect(upsertById(list, { id: "c", n: 4 }).map(item => item.id)).toEqual(["a", "b", "c"])
    expect(upsertById(list, { id: "c", n: 4 }, "start").map(item => item.id)).toEqual(["c", "a", "b"])
  })

  it("never changes the list it is given", () => {
    upsertById(list, { id: "a", n: 9 })
    expect(list[0]).toEqual({ id: "a", n: 1 })
  })
})
