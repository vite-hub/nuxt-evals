<script setup lang="ts">
import { refDebounced, useTitle } from "@vueuse/core"
import { computed } from "vue"
import LoadError from "../components/LoadError.vue"
import PlanRecipeDialog from "../components/PlanRecipeDialog.vue"
import RecipeCard from "../components/RecipeCard.vue"
import RecipeFilters from "../components/RecipeFilters.vue"
import { useQueryDialog } from "../composables/query-dialog"
import { useRecipeList } from "../composables/recipe-list"
import { useRecipes } from "../composables/recipes"
import { useI18n } from "../i18n"

const { t } = useI18n()
useTitle(computed(() => t.value.app.title(t.value.list.title)))
const { status, cuisines, summary } = useRecipes()
const { state, count, shown, pages, isFiltered, update, clear, pageQuery } = useRecipeList()

// Announced once the results settle, not on every key.
const announced = refDebounced(count, 600)
const { current: planning, open: openPlan, close: closePlan } = useQueryDialog("plan")
const planned = computed(() => planning.value ? summary(planning.value) : undefined)
</script>

<template>
  <div class="page">
    <h1 tabindex="-1">
      {{ t.list.title }}
    </h1>
    <RecipeFilters :state="state" :cuisines="cuisines" @change="update" />

    <p v-if="status === 'loading'" class="muted" role="status">
      {{ t.app.loading }}
    </p>
    <LoadError v-else-if="status === 'error'" />
    <template v-else>
      <div class="summary">
        <p class="count">
          {{ t.list.count(count) }}<template v-if="pages > 1">
            · {{ t.list.page(state.page, pages) }}
          </template>
        </p>
        <p class="visually-hidden" role="status">
          {{ t.list.found(announced) }}
        </p>
        <RouterLink :to="{ name: 'recipe-new' }" class="button small">
          {{ t.list.newRecipe }}
        </RouterLink>
      </div>

      <div v-if="!count" class="empty">
        <p>{{ t.list.none }}</p>
        <button v-if="isFiltered" type="button" class="button" @click="clear">
          {{ t.list.clear }}
        </button>
      </div>
      <ul v-else class="grid">
        <li v-for="recipe in shown" :key="recipe.id">
          <RecipeCard :recipe="recipe" @plan="openPlan(recipe.id)" />
        </li>
      </ul>

      <nav v-if="pages > 1" class="pagination" :aria-label="t.list.pages">
        <RouterLink v-if="state.page > 1" class="button" :to="{ query: pageQuery(state.page - 1) }" rel="prev">
          {{ t.list.previous }}
        </RouterLink>
        <span class="muted">{{ t.list.page(state.page, pages) }}</span>
        <RouterLink v-if="state.page < pages" class="button" :to="{ query: pageQuery(state.page + 1) }" rel="next">
          {{ t.list.next }}
        </RouterLink>
      </nav>
    </template>

    <PlanRecipeDialog v-if="planned" :recipe="planned" @close="closePlan" />
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.count {
  margin: 0;
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
</style>
