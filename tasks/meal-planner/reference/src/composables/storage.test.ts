import { afterEach, describe, expect, it } from "vitest"
import { nextTick } from "vue"
import { storageOutdated, useVersionedStorage } from "./storage"

const shape = {
  version: 2,
  parse: (data: unknown) => Array.isArray(data) && data.every(item => typeof item === "number") ? data : null,
  migrate: { 2: (data: unknown) => Array.isArray(data) ? data.map(Number) : data },
  initial: [] as number[],
}

afterEach(() => {
  localStorage.clear()
  storageOutdated.value = false
})

describe("useVersionedStorage", () => {
  it("writes nothing until something changes, then keeps a version with the data", async () => {
    const state = useVersionedStorage("test:plain", shape)
    expect(localStorage.getItem("test:plain")).toBeNull()
    state.value = [1, 2]
    await nextTick()
    expect(JSON.parse(localStorage.getItem("test:plain")!)).toEqual({ version: 2, data: [1, 2] })
  })

  it("starts fresh from garbage and writes the fresh value over it", async () => {
    localStorage.setItem("test:garbage", "{not json")
    expect(useVersionedStorage("test:garbage", shape).value).toEqual([])
    await nextTick()
    expect(JSON.parse(localStorage.getItem("test:garbage")!)).toEqual({ version: 2, data: [] })
  })

  it("migrates data of an older version", () => {
    localStorage.setItem("test:old", JSON.stringify({ version: 1, data: ["1", "2"] }))
    expect(useVersionedStorage("test:old", shape).value).toEqual([1, 2])
  })

  it("never writes over data of a newer version", async () => {
    const newer = JSON.stringify({ version: 3, data: { something: "else" } })
    localStorage.setItem("test:newer", newer)
    const state = useVersionedStorage("test:newer", shape)
    expect(storageOutdated.value).toBe(true)
    state.value = [9]
    await nextTick()
    expect(localStorage.getItem("test:newer")).toBe(newer)
  })
})
