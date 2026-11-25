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
 * A time that happens twice (clocks going back) gets one of its two instants; both are that wall-clock time. A time that never happens
 * (clocks jumping forward) comes back shifted; eventInputSchema rejects it by converting back.
 */
export function zonedLocalToInstant(local: string, timeZone: string): Date {
  const [date = "", time = ""] = local.split("T")
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const wallClockAsUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!)
  if (Number.isNaN(wallClockAsUtc)) return new Date(Number.NaN)
  let instant = wallClockAsUtc - offsetAt(wallClockAsUtc, timeZone)
  const corrected = wallClockAsUtc - offsetAt(instant, timeZone)
  if (corrected !== instant) instant = corrected
  return new Date(instant)
}

/** The inverse of zonedLocalToInstant, for the value of an `<input type="datetime-local">`. */
export function instantToZonedLocal(instant: Date | string | number, timeZone: string): string {
  const epochMs = new Date(instant).getTime()
  if (Number.isNaN(epochMs)) return ""
  return new Date(epochMs + offsetAt(epochMs, timeZone)).toISOString().slice(0, 16)
}

/** The IANA name for `value` ("europe/madrid" → "Europe/Madrid"), or null for anything else, offsets like "+01:00" included. */
export function canonicalTimeZone(value: string): string | null {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value)) return null
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone
  }
  catch {
    return null
  }
}
