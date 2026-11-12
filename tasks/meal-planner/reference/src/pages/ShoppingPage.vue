<script setup lang="ts">
import { useTitle } from "@vueuse/core"
import { computed, watch } from "vue"
import LoadError from "../components/LoadError.vue"
import ShoppingItemRow from "../components/ShoppingItemRow.vue"
import UnloadedMeals from "../components/UnloadedMeals.vue"
import UnitToggle from "../components/UnitToggle.vue"
import WeekNav from "../components/WeekNav.vue"
import { useHousehold } from "../composables/household"
import { usePantry } from "../composables/pantry"
import { usePlan } from "../composables/plan"
import { useRecipes } from "../composables/recipes"
import { useSettings } from "../composables/settings"
import { useShopping } from "../composables/shopping"
import { useWeek } from "../composables/week"
import { entriesOn } from "../domain/plan"
import { displayItem, isCovered, shoppingList } from "../domain/shopping"
import { useI18n } from "../i18n"

const props = defineProps<{ week?: string }>()
const { t, language, wording, aisleName } = useI18n()
const week = useWeek(() => props.week)
useTitle(computed(() => t.value.app.title(t.value.shopping.pageTitle(week.label.value))))
const { plan } = usePlan()
const recipes = useRecipes()
const { people } = useHousehold()
const { pantry } = usePantry()
const { units } = useSettings()
const { isTicked, toggleTicked } = useShopping()

const entries = computed(() => entriesOn(plan.value, week.days.value))
watch(entries, list => void recipes.ensure(list.map(entry => entry.recipeId)), { immediate: true })
const loadingRecipes = computed(() => entries.value.some(entry => recipes.state(entry.recipeId) === "loading"))
const recipeMap = computed(() => new Map(entries.value.flatMap(entry => {
  const recipe = recipes.recipe(entry.recipeId)
  return recipe ? [[recipe.id, recipe] as const] : []
})))
const aisles = computed(() => shoppingList(entries.value, recipeMap.value, recipes.catalog.value, people.value, pantry.value, language.value))
const toBuy = computed(() => aisles.value
  .map(aisle => ({ ...aisle, items: aisle.items.filter(item => !isCovered(item)) }))
  .filter(aisle => aisle.items.length))
const covered = computed(() => aisles.value.flatMap(aisle => aisle.items).filter(isCovered)
  .map(item => ({ key: item.key, ...displayItem(item, units.value, wording.value) })))
const print = () => window.print()
</script>

<template>
  <div class="page shopping">
    <WeekNav :title="t.shopping.title" route="shopping" :week="week" />
    <div class="toolbar no-print">
      <RouterLink class="button" :to="{ name: 'plan', params: { week: week.key.value } }">
        {{ t.shopping.back }}
      </RouterLink>
      <RouterLink class="button" :to="{ name: 'pantry' }">
        {{ t.shopping.pantryLink }}
      </RouterLink>
      <button v-if="toBuy.length" type="button" class="button" @click="print">
        {{ t.shopping.print }}
      </button>
      <UnitToggle />
    </div>

    <p v-if="recipes.status.value === 'loading' || loadingRecipes" class="muted" role="status">
      {{ t.shopping.loadingRecipes }}
    </p>
    <LoadError v-else-if="recipes.status.value === 'error'" />
    <div v-else-if="!entries.length" class="empty">
      <p>{{ t.shopping.empty }}</p>
      <RouterLink class="button primary" :to="{ name: 'plan', params: { week: week.key.value } }">
        {{ t.shopping.planWeek }}
      </RouterLink>
    </div>
    <template v-else>
      <UnloadedMeals :entries="entries" />
      <p class="muted no-print">
        {{ t.shopping.intro(entries.length) }}
      </p>
      <p v-if="!toBuy.length" class="empty">
        {{ t.shopping.allCovered }}
      </p>
      <section v-for="aisle in toBuy" :key="aisle.name" class="aisle">
        <h2>
          {{ aisleName(aisle.name) }}
        </h2>
        <ul class="items">
          <ShoppingItemRow
            v-for="item in aisle.items"
            :key="item.key"
            :item="item"
            :ticked="isTicked(week.key.value, item.key)"
            @tick="toggleTicked(week.key.value, item.key)"
          />
        </ul>
      </section>
      <section v-if="covered.length" class="aisle no-print" aria-labelledby="covered-title">
        <h2 id="covered-title">
          {{ t.shopping.covered }}
        </h2>
        <ul class="items">
          <li v-for="item in covered" :key="item.key" class="covered-row">
            <strong>{{ item.name }}</strong> <span class="muted">{{ item.needed.join(" + ") }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.shopping {
  max-width: 48rem;
}

.toolbar {
  margin-bottom: 1rem;
}

.aisle h2 {
  margin: 1.5rem 0 0.5rem;
  font-size: 1.1rem;
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border);
}

.covered-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}
</style>
