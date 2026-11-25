import { describe, expect, it } from "vitest"
import { addDays, parseDateKey, startOfWeek, toDateKey, weekDays } from "./dates.ts"

// vite.config.ts runs the tests in Europe/Berlin, which changes to and from summer time.
describe("dates", () => {
  it("runs in a time zone with daylight saving time", () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).not.toBe(new Date(2026, 0, 1).getTimezoneOffset())
  })

  it("keys a date by its local day, not the UTC day", () => {
    expect(toDateKey(new Date(2026, 10, 12, 0, 30))).toBe("2026-11-12")
    expect(toDateKey(new Date(2026, 10, 12, 23, 30))).toBe("2026-11-12")
  })

  it("starts weeks on Monday", () => {
    expect(toDateKey(startOfWeek(new Date(2026, 10, 15, 22)))).toBe("2026-11-09")
    expect(toDateKey(startOfWeek(new Date(2026, 10, 9, 0, 1)))).toBe("2026-11-09")
  })

  it.each([
    ["2026-10-26", ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]],
    ["2027-03-29", ["2027-03-29", "2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02", "2027-04-03", "2027-04-04"]],
    ["2026-03-23", ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"]],
  ])("has seven days across a clock change (week of %s)", (monday, days) => {
    expect(weekDays(parseDateKey(monday)!)).toEqual(days)
  })

  it("adds days by the calendar", () => {
    expect(toDateKey(addDays(parseDateKey("2026-10-25")!, 1))).toBe("2026-10-26")
    expect(toDateKey(addDays(parseDateKey("2026-03-29")!, -1))).toBe("2026-03-28")
  })

  it("refuses dates that don't exist", () => {
    expect(parseDateKey("2026-02-30")).toBeNull()
    expect(parseDateKey("tomorrow")).toBeNull()
  })
})
