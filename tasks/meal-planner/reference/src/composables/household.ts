import { createGlobalState } from "@vueuse/core"
import { upsertById } from "../domain/lists"
import { parsePerson, validItems } from "../domain/schema"
import type { Person } from "../domain/types"
import { useVersionedStorage } from "./storage"

/** The people the user cooks for. Meals name who eats them by id, so removing someone updates every meal. */
export const useHousehold = createGlobalState(() => {
  const people = useVersionedStorage<Person[]>("meal-planner:household", { version: 1, parse: data => validItems(data, parsePerson), initial: [] })
  return {
    people,
    save(person: Person) {
      people.value = upsertById(people.value, person)
    },
    /** Removes someone and returns a function that puts them back where they were, keeping any edits made since. */
    remove(id: string): () => void {
      const at = people.value.findIndex(person => person.id === id)
      const removed = people.value[at]
      people.value = people.value.filter(person => person.id !== id)
      return () => {
        if (!removed || people.value.some(person => person.id === id)) return
        people.value = people.value.toSpliced(at, 0, removed)
      }
    },
  }
})
