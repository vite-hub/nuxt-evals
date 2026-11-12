import { createGlobalState } from "@vueuse/core"
import { parseShopping } from "../domain/schema"
import type { ShoppingState } from "../domain/types"
import { useVersionedStorage } from "./storage"

const toggle = (list: readonly string[], key: string) => list.includes(key) ? list.filter(item => item !== key) : [...list, key]

/** Ticks on the shopping list. They belong to the week they were made in. */
export const useShopping = createGlobalState(() => {
  // Version 2 moved "at home" into the pantry: the ticks carry over.
  const shopping = useVersionedStorage<ShoppingState>("meal-planner:shopping", { version: 2, parse: parseShopping, migrate: { 2: data => data }, initial: { ticked: {} } })
  return {
    shopping,
    isTicked: (week: string, key: string) => shopping.value.ticked[week]?.includes(key) ?? false,
    toggleTicked(week: string, key: string) {
      shopping.value = { ...shopping.value, ticked: { ...shopping.value.ticked, [week]: toggle(shopping.value.ticked[week] ?? [], key) } }
    },
  }
})
