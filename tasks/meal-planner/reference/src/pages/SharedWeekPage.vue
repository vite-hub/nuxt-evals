<script setup lang="ts">
import { computedAsync, useTitle } from "@vueuse/core"
import { computed, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import AppDialog from "../components/AppDialog.vue"
import { usePlan } from "../composables/plan"
import { useQueryDialog } from "../composables/query-dialog"
import { useRecipes } from "../composables/recipes"
import { notify } from "../composables/toasts"
import { parseDateKey, weekDays } from "../domain/dates"
import { ingredientName } from "../domain/ingredients"
import { entriesOn } from "../domain/plan"
import { decodeWeek, ShareError, type SharedWeek, sharedEntries } from "../domain/share"
import { meals } from "../domain/types"
import { useI18n } from "../i18n"

// A week someone shared: read-only, from the link alone. Nothing is written until the user copies it.
const route = useRoute()
const router = useRouter()
const { t, language, formatDate } = useI18n()
const recipes = useRecipes()
const { plan, copy, undo } = usePlan()

const broken = ref(false)
const shared = computedAsync<SharedWeek | undefined>(async () => {
  broken.value = false
  try {
    return await decodeWeek(route.hash.slice(1))
  }
  catch (error) {
    if (!(error instanceof ShareError)) throw error
    broken.value = true
    return undefined
  }
}, undefined, { lazy: false })

const days = computed(() => {
  const week = shared.value
  const monday = week && parseDateKey(week.week)
  if (!week || !monday) return []
  return weekDays(monday).map((key, day) => ({
    key,
    label: formatDate(key, { weekday: "long", day: "numeric", month: "long" }),
    meals: meals.map(meal => ({ meal, items: week.meals.filter(item => item.day === day && item.meal === meal) })).filter(slot => slot.items.length),
  }))
})
const weekLabel = computed(() => shared.value ? formatDate(shared.value.week, { day: "numeric", month: "long", year: "numeric" }) : "")
useTitle(computed(() => t.value.app.title(weekLabel.value ? t.value.share.pageTitle(weekLabel.value) : t.value.share.title)))

const customOf = (id: string) => shared.value?.recipes.find(recipe => recipe.id === id)
const titleOf = (id: string) => customOf(id)?.title ?? recipes.summary(id)?.title ?? `#${id}`
const existing = computed(() => days.value.length ? entriesOn(plan.value, days.value.map(day => day.key)).length : 0)
const choosing = useQueryDialog("copy")

async function copyWeek(mode: "merge" | "replace") {
  const week = shared.value
  if (!week) return
  for (const recipe of week.recipes) if (!recipes.recipe(recipe.id)) recipes.saveRecipe(recipe)
  copy(days.value.map(day => day.key), sharedEntries(week), mode)
  notify(t.value.share.copied(week.meals.length), "info", { label: t.value.app.undo, run: undo })
  // The shared week leaves the history, dialog entry and all, so Back doesn't lead to it again and invite a second copy.
  if (choosing.current.value) {
    const back = new Promise<void>(resolve => { const stop = router.afterEach(() => { stop(); resolve() }) })
    router.back()
    await back
  }
  await router.replace({ name: "plan", params: { week: week.week } })
}
</script>

<template>
  <div class="page shared">
    <h1 tabindex="-1">
      {{ t.share.title }} <span v-if="weekLabel" class="week">{{ weekLabel }}</span>
    </h1>
    <p v-if="broken" class="empty" role="alert">
      {{ t.share.broken }}
    </p>
    <p v-else-if="!shared" class="muted" role="status">
      {{ t.share.loading }}
    </p>
    <template v-else>
      <p class="muted">
        {{ t.share.intro }} <span class="chip">{{ t.share.readOnly }}</span>
      </p>
      <div class="toolbar">
        <button type="button" class="button primary" @click="existing ? choosing.open('week') : void copyWeek('merge')">
          {{ t.share.copy }}
        </button>
      </div>
      <ol class="days">
        <li v-for="day in days" :key="day.key" class="card day">
          <h2>{{ day.label }}</h2>
          <p v-if="!day.meals.length" class="muted">
            {{ t.plan.nothing }}
          </p>
          <section v-for="slot in day.meals" :key="slot.meal">
            <h3>{{ t.words.meals[slot.meal] }}</h3>
            <ul class="meals">
              <li v-for="(item, index) in slot.items" :key="`${item.recipeId}-${index}`">
                <RouterLink v-if="!customOf(item.recipeId)" :to="{ name: 'recipe', params: { id: item.recipeId } }">
                  {{ titleOf(item.recipeId) }}
                </RouterLink>
                <details v-else>
                  <summary>{{ titleOf(item.recipeId) }} <span class="muted">({{ t.share.custom }})</span></summary>
                  <p class="muted">
                    {{ t.share.ingredients }}: {{ customOf(item.recipeId)!.ingredients.map(line => ingredientName(line, recipes.catalog.value, language)).join(", ") }}
                  </p>
                </details>
                <span class="muted"> · {{ t.share.eaters(item.eaters) }}</span>
              </li>
            </ul>
          </section>
        </li>
      </ol>
    </template>
    <AppDialog v-if="choosing.current.value && shared" v-slot="{ close }" :title="t.share.copy" @close="choosing.close">
      <p>{{ t.share.choose(existing) }}</p>
      <div class="toolbar">
        <button type="button" class="button primary" @click="void copyWeek('merge')">
          {{ t.share.merge }}
        </button>
        <button type="button" class="button danger" @click="void copyWeek('replace')">
          {{ t.share.replace }}
        </button>
        <button type="button" class="button" @click="close">
          {{ t.app.cancel }}
        </button>
      </div>
    </AppDialog>
  </div>
</template>

<style scoped>
.shared {
  max-width: 56rem;
}

.week {
  display: block;
  color: var(--muted);
  font-size: 1rem;
  font-weight: 500;
}

.days {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.day {
  padding: 0.9rem 1rem;
}

.day h2 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}

.day h3 {
  margin: 0.5rem 0 0.25rem;
  color: var(--muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meals {
  margin: 0;
  padding-left: 1.1rem;
}
</style>
