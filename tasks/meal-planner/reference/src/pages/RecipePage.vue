<script setup lang="ts">
import { useOnline, useTitle } from "@vueuse/core"
import { computed, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import HouseholdFit from "../components/HouseholdFit.vue"
import PlanRecipeDialog from "../components/PlanRecipeDialog.vue"
import ServingsInput from "../components/ServingsInput.vue"
import UnitToggle from "../components/UnitToggle.vue"
import { usePlanActions } from "../composables/plan-actions"
import { useQueryDialog } from "../composables/query-dialog"
import { useRecipeDeletion } from "../composables/recipe-deletion"
import { useRecipes } from "../composables/recipes"
import { useSettings } from "../composables/settings"
import { notify } from "../composables/toasts"
import { toDateKey } from "../domain/dates"
import { displayLine, ingredientKey } from "../domain/ingredients"
import { useI18n } from "../i18n"
import NotFoundView from "../components/NotFoundView.vue"

// `id` comes from the route as a prop, so moving from one recipe to another updates everything below.
const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const { t, wording, formatNumber, cuisineName } = useI18n()
const recipes = useRecipes()
const { units } = useSettings()
const deletion = useRecipeDeletion()
const actions = usePlanActions()

// Only this recipe's shard loads: a deep link shows the recipe without waiting for the whole list.
watch(() => props.id, id => void recipes.ensure([id]), { immediate: true })
const recipe = computed(() => recipes.recipe(props.id))
const state = computed(() => recipes.state(props.id))
useTitle(computed(() => t.value.app.title(state.value === "missing" ? t.value.notFound.title : recipe.value?.title ?? recipes.summary(props.id)?.title ?? t.value.recipe.loading)))
const online = useOnline()

// Servings live in the URL (`?servings=8`), so a scaled recipe can be shared and survives a reload.
const servings = computed(() => {
  const value = Number(route.query.servings)
  return Number.isInteger(value) && value >= 1 && value <= 99 ? value : recipe.value?.servings ?? 1
})
function setServings(value: number) {
  void router.replace({ query: { ...route.query, servings: value === recipe.value?.servings ? undefined : String(value) } })
}

const lines = computed(() => {
  const current = recipe.value
  return current ? current.ingredients.map((line, index) => ({ key: `${ingredientKey(line)}-${index}`, ...displayLine(line, servings.value / current.servings, units.value, recipes.catalog.value, wording.value) })) : []
})
const { current: planning, open: openPlan, close: closePlan } = useQueryDialog("plan")

/** One tap: tonight's dinner, for everyone. */
function planTonight() {
  const current = recipe.value
  if (!current) return
  actions.add(current, { date: toDateKey(new Date()), meal: "dinner" })
}

function removeRecipe() {
  const current = recipe.value
  if (!current) return
  if (!window.confirm(t.value.recipe.deleteConfirm(current.title, deletion.plannedMeals(current.id)))) return
  deletion.deleteRecipe(current.id)
  notify(t.value.recipe.deleted(current.title))
  void router.push({ name: "my-recipes" })
}
</script>

<template>
  <NotFoundView v-if="state === 'missing'" />
  <article v-else class="page recipe">
    <h1 tabindex="-1">
      {{ recipe?.title ?? recipes.summary(id)?.title ?? t.recipe.loading }}
    </h1>
    <div v-if="state === 'unavailable'" class="empty" role="alert">
      <p>{{ online ? t.recipe.loadError : t.recipe.offline }}</p>
      <button type="button" class="button primary" @click="recipes.ensure([id])">
        {{ t.app.retry }}
      </button>
    </div>
    <template v-if="recipe">
      <p class="description">
        {{ recipe.description }}
      </p>
      <dl class="facts">
        <div><dt>{{ t.recipe.time }}</dt><dd>{{ t.words.minutes(recipe.minutes) }}</dd></div>
        <div><dt>{{ t.recipe.cuisine }}</dt><dd>{{ cuisineName(recipe.cuisine) }}</dd></div>
        <div v-if="recipe.caloriesPerServing !== undefined">
          <dt>{{ t.recipe.calories }}</dt><dd>{{ t.recipe.perServing(formatNumber(recipe.caloriesPerServing)) }}</dd>
        </div>
        <div v-if="recipe.rating !== undefined">
          <dt>{{ t.recipe.rating }}</dt><dd>{{ t.recipe.ratingValue(formatNumber(recipe.rating), recipe.ratingCount ?? 0) }}</dd>
        </div>
        <div v-if="recipe.diets.length">
          <dt>{{ t.recipe.diets }}</dt><dd>{{ recipe.diets.map(diet => t.words.diets[diet]).join(", ") }}</dd>
        </div>
      </dl>
      <HouseholdFit :ingredients="recipe.ingredients" />
      <div class="toolbar no-print">
        <button type="button" class="button primary" @click="planTonight">
          {{ t.recipe.planTonight }}
        </button>
        <button type="button" class="button" @click="openPlan(recipe.id)">
          {{ t.recipe.addToPlan }}
        </button>
        <template v-if="recipe.custom">
          <RouterLink class="button" :to="{ name: 'recipe-edit', params: { id: recipe.id } }">
            {{ t.recipe.edit }}
          </RouterLink>
          <button type="button" class="button danger" @click="removeRecipe">
            {{ t.recipe.delete }}
          </button>
        </template>
      </div>

      <div class="columns">
        <section aria-labelledby="ingredients-title">
          <h2 id="ingredients-title">
            {{ t.recipe.ingredients }}
          </h2>
          <div class="controls no-print">
            <ServingsInput :model-value="servings" :label="t.recipe.servings" @update:model-value="setServings" />
            <UnitToggle />
          </div>
          <p v-if="!recipes.catalog.value.size" class="muted" role="status">
            {{ t.recipe.loading }}
          </p>
          <ul v-else class="ingredients">
            <li v-for="line in lines" :key="line.key">
              <strong v-if="line.amount">{{ line.amount }}</strong>
              {{ line.name }}<span v-if="!line.amount" class="muted">, {{ t.words.toTaste }}</span><span v-if="line.note" class="muted">, {{ line.note }}</span>
            </li>
          </ul>
        </section>
        <section aria-labelledby="steps-title">
          <h2 id="steps-title">
            {{ t.recipe.steps }}
          </h2>
          <ol class="steps">
            <li v-for="(step, index) in recipe.steps" :key="index">
              {{ step }}
            </li>
          </ol>
        </section>
      </div>
      <PlanRecipeDialog v-if="planning === recipe.id" :recipe="recipe" @close="closePlan" />
    </template>
  </article>
</template>

<style scoped>
.description {
  max-width: 60ch;
  color: var(--muted);
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2rem;
  margin: 1rem 0 1.25rem;
}

.facts dt {
  color: var(--muted);
  font-size: 0.8rem;
}

.facts dd {
  margin: 0;
  font-weight: 600;
}

.capitalize {
  text-transform: capitalize;
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 2rem;
  margin-top: 1.5rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  margin-bottom: 1rem;
}

.ingredients {
  display: grid;
  gap: 0.4rem;
  padding-left: 1.1rem;
}

.steps {
  display: grid;
  gap: 0.75rem;
  padding-left: 1.3rem;
  max-width: 60ch;
}

@media (max-width: 48rem) {
  .columns {
    grid-template-columns: 1fr;
  }
}
</style>
