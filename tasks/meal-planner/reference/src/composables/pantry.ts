import { createGlobalState } from "@vueuse/core"
import { parsePantry } from "../domain/schema"
import type { Pantry } from "../domain/types"
import { useVersionedStorage } from "./storage"

/** What the user has at home, by ingredient. The shopping list takes it off what a week needs. */
export const usePantry = createGlobalState(() => {
  const pantry = useVersionedStorage<Pantry>("meal-planner:pantry", { version: 1, parse: parsePantry, initial: {} })
  return {
    pantry,
    set(key: string, amount: Pantry[string]) {
      pantry.value = { ...pantry.value, [key]: amount }
    },
    /** Removes an item and returns a function that puts it back. */
    remove(key: string): () => void {
      const { [key]: removed, ...rest } = pantry.value
      pantry.value = rest
      return () => {
        if (removed) pantry.value = { ...pantry.value, [key]: removed }
      }
    },
  }
})
