/**
 * The list with `item` in place of the one with its id, or with `item` added (at the end, or at the start for lists
 * shown newest first) when none has it. Returns a new list.
 */
export function upsertById<T extends { id: string }>(list: readonly T[], item: T, newAt: "start" | "end" = "end"): T[] {
  if (list.some(existing => existing.id === item.id)) return list.map(existing => existing.id === item.id ? item : existing)
  return newAt === "start" ? [item, ...list] : [...list, item]
}
