import { createGlobalState } from "@vueuse/core"
import { computed, ref, shallowRef } from "vue"
import { indexFile, ingredientsFile, shardFiles, shardSize } from "virtual:recipe-data"
import { parseIndex, type RecipeIndex, type RecipeSummary, summaryAt } from "../domain/recipe-index"
import { upsertById } from "../domain/lists"
import { parseIngredient, parseRecipe, validItems } from "../domain/schema"
import type { Ingredient, Recipe } from "../domain/types"
import { useVersionedStorage } from "./storage"

/**
 * One of the build's data files. Plain `json()`: these files come from our own build, and the parsers below check every
 * field anyway. (Dropping `__proto__` keys with a reviver, as imports do, would cost half a second on a slow phone.)
 */
async function fetchData(file: string): Promise<unknown> {
  const response = await fetch(import.meta.env.BASE_URL + file)
  if (!response.ok) throw new Error(`${file} answered ${response.status}`)
  return await response.json() as unknown
}

/** Whether a recipe could be loaded: `unavailable` is a shard the browser couldn't fetch, offline or on an error. */
export type RecipeState = "loading" | "ready" | "missing" | "unavailable"

const summarize = (recipe: Recipe): RecipeSummary => ({
  id: recipe.id,
  title: recipe.title,
  cuisine: recipe.cuisine,
  course: recipe.course,
  diets: recipe.diets,
  minutes: recipe.minutes,
  ...(recipe.caloriesPerServing === undefined ? {} : { caloriesPerServing: recipe.caloriesPerServing }),
  servings: recipe.servings,
  ...(recipe.custom ? { custom: true } : {}),
})

/**
 * The recipes. The list index (every built-in recipe, in columns) and the ingredients load once; full recipes load by
 * shard when a page needs them and stay in memory. The user's own recipes live in storage. Nothing here is deeply
 * reactive: the index and loaded recipes sit in shallowRefs and are never wrapped in proxies.
 */
export const useRecipes = createGlobalState(() => {
  const index = shallowRef<RecipeIndex>()
  const catalog = shallowRef<ReadonlyMap<string, Ingredient>>(new Map())
  const status = ref<"loading" | "ready" | "error">("loading")
  const custom = useVersionedStorage<Recipe[]>("meal-planner:recipes", { version: 1, parse: data => validItems(data, parseRecipe)?.filter(recipe => recipe.custom) ?? null, initial: [] })
  const loaded = shallowRef<ReadonlyMap<string, Recipe>>(new Map())
  const shards = shallowRef<ReadonlyMap<number, "loading" | "loaded" | "failed">>(new Map())
  const setShard = (shard: number, value: "loading" | "loaded" | "failed") => (shards.value = new Map(shards.value).set(shard, value))
  let loading: Promise<void> | undefined

  /** Starts loading the index and the ingredients, or returns the load in progress. After a failure, calling it again retries. */
  function load(): Promise<void> {
    loading ??= (async () => {
      status.value = "loading"
      try {
        // The catalog arrives on its own, so the recipe form can name ingredients even when the index fails.
        const ingredients = fetchData(ingredientsFile).then((data) => {
          catalog.value = new Map((validItems(data, parseIngredient) ?? []).map(ingredient => [ingredient.id, ingredient]))
        })
        const [data] = await Promise.all([fetchData(indexFile), ingredients])
        const parsed = parseIndex(data)
        if (!parsed) throw new Error(`${indexFile} has the wrong shape`)
        index.value = Object.freeze(parsed)
        status.value = "ready"
      }
      catch (error) {
        console.error("Recipes failed to load", error)
        status.value = "error"
        loading = undefined
      }
    })()
    return loading
  }

  const positions = computed(() => new Map(index.value?.ids.map((id, at) => [String(id), at]) ?? []))
  const cuisines = computed(() => index.value?.cuisines ?? [])

  const customById = computed(() => new Map(custom.value.map(recipe => [recipe.id, recipe])))
  const customSummaries = computed(() => custom.value.map(summarize))

  /** What the list and the planner show of a recipe, without loading it whole. */
  function summary(id: string): RecipeSummary | undefined {
    const own = customById.value.get(id)
    if (own) return summarize(own)
    const at = positions.value.get(id)
    return index.value && at !== undefined ? summaryAt(index.value, at) : undefined
  }

  /** A whole recipe, once it is loaded (see `ensure`). */
  function recipe(id: string): Recipe | undefined {
    return customById.value.get(id) ?? loaded.value.get(id)
  }

  function state(id: string): RecipeState {
    if (recipe(id)) return "ready"
    const shard = Math.floor(Number(id) / shardSize)
    if (!/^\d+$/.test(id) || !(shard in shardFiles)) return "missing"
    const shardState = shards.value.get(shard)
    return shardState === "failed" ? "unavailable" : shardState === "loaded" ? "missing" : "loading"
  }

  async function loadShard(shard: number): Promise<void> {
    const file = shardFiles[shard]
    if (!file || shards.value.get(shard) === "loading" || shards.value.get(shard) === "loaded") return
    setShard(shard, "loading")
    try {
      const recipes = validItems(await fetchData(file), parseRecipe) ?? []
      const next = new Map(loaded.value)
      for (const item of recipes) next.set(item.id, Object.freeze(item))
      loaded.value = next
      setShard(shard, "loaded")
    }
    catch (error) {
      // Offline with a shard never opened, or a network error: the page says the recipe is unavailable, and a later
      // `ensure` tries again.
      console.error(`Recipe shard ${shard} failed to load`, error)
      setShard(shard, "failed")
    }
  }

  /** Loads the shards holding these recipes. Custom recipes are always there. */
  async function ensure(ids: Iterable<string>): Promise<void> {
    const needed = new Set([...ids].filter(id => /^\d+$/.test(id) && !loaded.value.has(id)).map(id => Math.floor(Number(id) / shardSize)))
    await Promise.all([...needed].map(loadShard))
  }

  /** Saves a recipe of the user's own. A new one goes first: the list shows the newest first. */
  function saveRecipe(item: Recipe) {
    custom.value = upsertById(custom.value, item, "start")
  }

  function deleteRecipe(id: string) {
    custom.value = custom.value.filter(item => item.id !== id)
  }

  /** The files of the shards loaded so far, for the service worker to keep offline. */
  const loadedFiles = () => [...shards.value].filter(([, state]) => state === "loaded").flatMap(([shard]) => shardFiles[shard] ?? [])

  return { status, load, index, catalog, cuisines, custom, customSummaries, summary, recipe, state, ensure, loadedFiles, saveRecipe, deleteRecipe }
})
