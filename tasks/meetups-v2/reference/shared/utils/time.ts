/** The offset of `timeZone` from UTC at the instant `epochMs`, in milliseconds. Madrid in summer: +2h. */
function offsetAt(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(epochMs)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)!.value)
  const wallClockAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"))
  return wallClockAsUtc - Math.floor(epochMs / 1000) * 1000
}

/**
 * The instant at which the wall clock in `timeZone` shows `local` ("2026-12-01T18:30").
 * Two passes, so a time next to a daylight-saving change uses the offset that applies then.
 */
export function zonedLocalToInstant(local: string, timeZone: string): Date {
  const [date = "", time = ""] = local.split("T")
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const wallClockAsUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!)
  let instant = wallClockAsUtc - offsetAt(wallClockAsUtc, timeZone)
  const corrected = wallClockAsUtc - offsetAt(instant, timeZone)
  if (corrected !== instant) instant = corrected
  return new Date(instant)
}

/** The inverse of zonedLocalToInstant, for the value of an `<input type="datetime-local">`. */
export function instantToZonedLocal(instant: Date | string | number, timeZone: string): string {
  const epochMs = new Date(instant).getTime()
  return new Date(epochMs + offsetAt(epochMs, timeZone)).toISOString().slice(0, 16)
}

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  }
  catch {
    return false
  }
}
