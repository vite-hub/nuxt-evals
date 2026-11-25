<script setup lang="ts">
import type { RecipeSummary } from "../domain/recipe-index"
import { useI18n } from "../i18n"

defineProps<{ recipe: RecipeSummary }>()
defineEmits<{ plan: [] }>()
const { t, formatNumber, cuisineName } = useI18n()
</script>

<template>
  <article class="card recipe-card">
    <h2 class="title">
      <RouterLink :to="{ name: 'recipe', params: { id: recipe.id } }">
        {{ recipe.title }}
      </RouterLink>
    </h2>
    <p class="meta muted">
      <span>{{ t.words.minutes(recipe.minutes) }}</span>
      <span>{{ cuisineName(recipe.cuisine) }}</span>
      <span v-if="recipe.rating !== undefined"><span aria-hidden="true">★ {{ formatNumber(recipe.rating) }}</span><span class="visually-hidden">{{ t.list.rating(formatNumber(recipe.rating)) }}</span></span>
      <span v-if="recipe.custom">{{ t.list.yours }}</span>
    </p>
    <ul v-if="recipe.diets.length" class="diets" :aria-label="t.list.dietsLabel">
      <li v-for="diet in recipe.diets" :key="diet" class="chip">
        {{ t.words.diets[diet] }}
      </li>
    </ul>
    <button type="button" class="button small plan" :aria-label="t.list.planLabel(recipe.title)" @click="$emit('plan')">
      {{ t.list.plan }}
    </button>
  </article>
</template>

<style scoped>
.recipe-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  padding: 1rem;
}

.title {
  margin: 0;
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.title a {
  color: var(--text);
  text-decoration: none;
}

.title a:hover {
  color: var(--brand-strong);
  text-decoration: underline;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0;
  font-size: 0.875rem;
}

.diets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan {
  align-self: flex-start;
  margin-top: auto;
}
</style>
