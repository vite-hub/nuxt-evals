// Dates in the plan are local calendar days, written `YYYY-MM-DD`. They are built from the local year, month and day,
// never from `toISOString()`, which gives the UTC day and is off by one east and west of Greenwich at the ends of the
// day. Days are added by changing the date part, not by adding 24 hours, which skips or repeats a day across a
// daylight saving change.

const pad = (value: number) => String(value).padStart(2, "0")

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight of a `YYYY-MM-DD` key, or null when the key isn't a real date. */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** The Monday that starts the week of `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

/** The seven date keys of the week that starts on `monday`. */
export function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(monday, index)))
}

/** A week's key is its Monday's date key. */
export function weekKey(date: Date): string {
  return toDateKey(startOfWeek(date))
}

