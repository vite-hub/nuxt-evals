import { computed, watch } from "vue"
import { type LocationQueryRaw, useRoute, useRouter } from "vue-router"
import { defaultListState, type ListState, pageSize, parseListQuery, sameQuery, toListQuery } from "../domain/list-query"
import { type RecipeSummary, searchAll, summaryOf } from "../domain/recipe-index"
import { language } from "../i18n"
import { useRecipes } from "./recipes"

/**
 * The recipe list: its search, filters, sort and page read from the URL, and the recipes they find. The URL is the only
 * place the state lives, so a shared link, a reload and Back all give the same list.
 */
export function useRecipeList() {
  const route = useRoute()
  const router = useRouter()
  const { status, index, cuisines, customSummaries } = useRecipes()
  const ready = computed(() => status.value === "ready")
  const parsed = computed(() => parseListQuery(route.query, ready.value ? cuisines.value : null))

  const found = computed(() => index.value ? searchAll(index.value, customSummaries.value, parsed.value, language.value) : [])
  const pages = computed(() => Math.max(1, Math.ceil(found.value.length / pageSize)))
  // A page past the end (an old link, or fewer results than before) shows the last page.
  const state = computed<ListState>(() => ready.value ? { ...parsed.value, page: Math.min(parsed.value.page, pages.value) } : parsed.value)
  const shown = computed<RecipeSummary[]>(() => {
    const data = index.value
    return data ? found.value.slice((state.value.page - 1) * pageSize, state.value.page * pageSize).map(item => summaryOf(data, item)) : []
  })
  const filtered = computed(() => toListQuery({ ...state.value, sort: defaultListState.sort, page: 1 }))

  /** The URL for a list state, keeping an open dialog. Parameters that mean nothing here are dropped. */
  const queryFor = (value: ListState): LocationQueryRaw => ({ ...(route.query.plan ? { plan: route.query.plan } : {}), ...toListQuery(value) })

  // The URL says what the list shows: values that mean nothing (a hand-edited `?time=abc`) and pages past the end are
  // cleaned up in place, without a history entry. The check stops once the route is another page's, which happens a
  // moment before this page unmounts.
  const listRoute = route.name
  watch(state, (value) => {
    const clean = queryFor(value)
    const strays = Object.keys(route.query).some(key => !(key in clean))
    if (route.name === listRoute && (strays || !sameQuery(route.query, toListQuery(value)))) void router.replace({ query: clean })
  }, { immediate: true })

  return {
    state,
    count: computed(() => found.value.length),
    shown,
    pages,
    /** Whether a search or filter narrows the list. */
    isFiltered: computed(() => Object.keys(filtered.value).length > 0),
    /** A new list: any change but paging starts again on page 1. */
    update: (change: Partial<ListState>) => void router.push({ query: toListQuery({ ...state.value, page: 1, ...change }) }),
    clear: () => void router.push({ query: {} }),
    pageQuery: (page: number) => toListQuery({ ...state.value, page }),
  }
}
