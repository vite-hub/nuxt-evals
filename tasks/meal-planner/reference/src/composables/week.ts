import { useIntervalFn, useNow } from "@vueuse/core"
import { computed, type MaybeRefOrGetter, toValue } from "vue"
import { addDays, parseDateKey, startOfWeek, toDateKey, weekDays } from "../domain/dates"
import { language } from "../i18n"

/**
 * The week a page shows: the one in the URL (its Monday's date), or this week. `today` moves on at midnight while the
 * page stays open.
 */
export function useWeek(param: MaybeRefOrGetter<string | undefined>) {
  // A minute is fine enough for "today"; the default would update on every animation frame.
  const now = useNow({ scheduler: callback => useIntervalFn(callback, 60_000) })
  const today = computed(() => toDateKey(now.value))
  const monday = computed(() => startOfWeek(parseDateKey(toValue(param) ?? "") ?? now.value))
  const key = computed(() => toDateKey(monday.value))
  const days = computed(() => weekDays(monday.value))
  const label = computed(() => {
    const format = new Intl.DateTimeFormat(language.value, { day: "numeric", month: "long", year: "numeric" })
    return format.formatRange(monday.value, addDays(monday.value, 6))
  })
  return {
    today,
    key,
    days,
    label,
    previous: computed(() => toDateKey(addDays(monday.value, -7))),
    next: computed(() => toDateKey(addDays(monday.value, 7))),
    isCurrent: computed(() => days.value.includes(today.value)),
    /** This week's key. */
    current: computed(() => toDateKey(startOfWeek(now.value))),
  }
}
