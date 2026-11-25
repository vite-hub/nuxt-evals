import { refDebounced } from "@vueuse/core"
import { computed, ref } from "vue"
import { searchAll, summaryOf } from "../domain/recipe-index"
import { language } from "../i18n"
import { useRecipes } from "./recipes"

/** A quick search box for picking a recipe: the best rated matches, `limit` of them, the user's own included. */
export function useRecipeSearch(limit: number) {
  const { index, customSummaries } = useRecipes()
  const q = ref("")
  const query = refDebounced(q, 200)
  const results = computed(() => {
    const data = index.value
    if (!data) return []
    return searchAll(data, customSummaries.value, { q: query.value, diets: [], cuisine: null, maxMinutes: null, sort: "rating" }, language.value)
      .slice(0, limit).map(found => summaryOf(data, found))
  })
  return { q, results }
}
