import { createRouter, createWebHistory, type RouteLocationNormalized, type RouteRecordRaw, type RouterHistory } from "vue-router"
import { nextTick } from "vue"
import { useRecipes } from "./composables/recipes"
import { focusAfterRender } from "./focus"
import { useSettings } from "./composables/settings"
import { notify } from "./composables/toasts"
import { parseDateKey, weekKey } from "./domain/dates"
import { browserLanguage, isLanguage, language, messages } from "./i18n"
import RecipeListPage from "./pages/RecipeListPage.vue"

const week = "(\\d{4}-\\d{2}-\\d{2})?"

/**
 * A week is addressed by its Monday, always in the URL, so a reload or a shared link opens the same week. No week is
 * this week; another day goes to its Monday; a date that doesn't exist, to this week.
 */
function toMonday(to: RouteLocationNormalized) {
  const param = typeof to.params.week === "string" ? to.params.week : ""
  const date = parseDateKey(param)
  const monday = weekKey(date ?? new Date())
  if (monday !== param) return { name: to.name, params: { ...to.params, week: monday }, query: to.query, hash: to.hash, replace: true }
}

/** The language for an address without one: the one last chosen, else the browser's. */
function preferredLanguage() {
  return useSettings().language.value ?? browserLanguage()
}

/**
 * Every page lives under its language (`/en/plan`, `/es/plan`), so a shared link opens in its language. Named routes
 * keep the current `lang` param, so links stay in the language without passing it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: "/:lang(en|es)",
    children: [
      { path: "", name: "recipes", component: RecipeListPage },
      { path: "recipes/new", name: "recipe-new", component: () => import("./pages/RecipeFormPage.vue") },
      { path: "recipes/:id", name: "recipe", component: () => import("./pages/RecipePage.vue"), props: true },
      { path: "recipes/:id/edit", name: "recipe-edit", component: () => import("./pages/RecipeFormPage.vue"), props: true },
      { path: "my-recipes", name: "my-recipes", component: () => import("./pages/MyRecipesPage.vue") },
      { path: `plan/:week${week}`, name: "plan", component: () => import("./pages/PlannerPage.vue"), props: true },
      { path: `shopping/:week${week}`, name: "shopping", component: () => import("./pages/ShoppingPage.vue"), props: true },
      { path: "pantry", name: "pantry", component: () => import("./pages/PantryPage.vue") },
      { path: "household", name: "household", component: () => import("./pages/HouseholdPage.vue") },
      { path: "shared", name: "shared", component: () => import("./pages/SharedWeekPage.vue") },
      { path: "settings", name: "settings", component: () => import("./pages/SettingsPage.vue") },
      { path: ":path(.*)*", name: "not-found", component: () => import("./pages/NotFoundPage.vue") },
    ],
  },
  // An address without a language (`/`, `/recipes/123`, an old bookmark) gets the preferred one in front.
  { path: "/:path(.*)*", redirect: to => ({ path: `/${preferredLanguage()}${to.path === "/" ? "" : to.path}`, query: to.query, hash: to.hash }) },
]

/**
 * The old app used hash links (`/#/recipe/123`, `/#/plan`). They map to today's paths, without the language; anything
 * else under `#/` keeps its path and lands on the not-found page if nothing matches it.
 */
export function legacyPath(hash: string): string | null {
  if (!hash.startsWith("#/")) return null
  const path = hash.slice(1)
  const recipe = /^\/recipe\/([^/?#]+)/.exec(path)
  return recipe ? `/recipes/${recipe[1]}` : path
}

/** Messages browsers give when a lazy chunk is gone, usually because a new version was deployed. */
const staleChunk = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i
/** The page last reloaded for a stale chunk, so a chunk that is really missing doesn't reload forever. */
const reloadKey = "meal-planner:reloaded"

/** sessionStorage, or null where the browser blocks it (then a stale chunk just shows the error). */
function session(): Storage | null {
  try {
    return window.sessionStorage
  }
  catch {
    return null
  }
}

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes,
    async scrollBehavior(to, from, saved) {
      if (saved) {
        // Back to the list: wait for its recipes, or the page isn't tall enough to scroll back to.
        await useRecipes().load()
        await nextTick()
        return saved
      }
      if (to.path === from.path && to.query.page === from.query.page) return false
      return { top: 0 }
    },
  })

  // Old hash links are replaced by their current address before any page renders, on the first load and when a hash
  // link is followed later, so Back never returns to them.
  router.beforeEach((to) => {
    const lang = isLanguage(to.params.lang) ? to.params.lang : preferredLanguage()
    const legacy = legacyPath(to.hash)
    if (legacy) return { path: `/${lang}${legacy === "/" ? "" : legacy}`, replace: true }
    // The page renders in the URL's language from its first frame.
    language.value = lang
    if (to.name === "plan" || to.name === "shopping") return toMonday(to)
  })

  router.afterEach((to, _from, failure) => {
    if (!failure && isLanguage(to.params.lang)) document.documentElement.lang = to.params.lang
  })

  // Focus follows the page, so keyboard and screen reader users start at the new page's heading. A change of query
  // alone (typing a search) keeps focus where it is.
  router.afterEach((to, from, failure) => {
    if (failure || !from.matched.length || to.path === from.path) return
    void focusAfterRender("main h1", document, { preventScroll: true })
  })

  // After a deploy the old lazy chunks are gone: load the page the user asked for from the new version, once.
  router.onError((error: Error, to) => {
    console.error(error)
    const storage = session()
    if (!storage || !staleChunk.test(error.message) || storage.getItem(reloadKey) === to.fullPath) {
      notify(messages.value.app.chunkError, "error")
      return
    }
    storage.setItem(reloadKey, to.fullPath)
    window.location.assign(to.fullPath)
  })
  router.afterEach((_to, _from, failure) => {
    if (!failure) session()?.removeItem(reloadKey)
  })

  return router
}
