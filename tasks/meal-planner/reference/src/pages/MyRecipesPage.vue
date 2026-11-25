<script setup lang="ts">
import { useTitle } from "@vueuse/core"
import { computed } from "vue"
import { useRecipes } from "../composables/recipes"
import { useI18n } from "../i18n"

const { t } = useI18n()
useTitle(computed(() => t.value.app.title(t.value.mine.title)))
const { custom } = useRecipes()
</script>

<template>
  <div class="page">
    <div class="heading">
      <h1 tabindex="-1">
        {{ t.mine.title }}
      </h1>
      <RouterLink class="button primary" :to="{ name: 'recipe-new' }">
        {{ t.list.newRecipe }}
      </RouterLink>
    </div>
    <div v-if="!custom.length" class="empty">
      <p>{{ t.mine.empty }}</p>
    </div>
    <ul v-else class="list">
      <li v-for="recipe in custom" :key="recipe.id" class="card item">
        <RouterLink :to="{ name: 'recipe', params: { id: recipe.id } }" class="title">
          {{ recipe.title }}
        </RouterLink>
        <span class="muted">{{ t.words.minutes(recipe.minutes) }} · {{ t.mine.serves(recipe.servings) }}</span>
        <RouterLink class="button small" :to="{ name: 'recipe-edit', params: { id: recipe.id } }" :aria-label="t.form.editTitle(recipe.title)">
          {{ t.mine.edit }}
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.heading h1 {
  margin: 0;
}

.list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.9rem 1rem;
}

.title {
  flex: 1;
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
