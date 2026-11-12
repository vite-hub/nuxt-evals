<script setup lang="ts">
import { computed } from "vue"
import { useHousehold } from "../composables/household"
import { useRecipes } from "../composables/recipes"
import type { IngredientLine } from "../domain/types"
import { warningKey, warningsFor } from "../domain/warnings"
import { useI18n } from "../i18n"

// Who in the household a recipe suits, and why not for the others, before it is planned.
const props = defineProps<{ ingredients: IngredientLine[] }>()
const { t, formatList, describeWarning } = useI18n()
const { people } = useHousehold()
const { catalog } = useRecipes()
const warnings = computed(() => warningsFor(props.ingredients, people.value, catalog.value))
const suited = computed(() => people.value.filter(person => !warnings.value.some(warning => warning.person.id === person.id)))
const names = (list: { name: string }[]) => formatList(list.map(person => person.name))
</script>

<template>
  <section class="fit" aria-labelledby="fit-title">
    <h2 id="fit-title" class="fit-title">
      {{ t.recipe.household }}
    </h2>
    <p v-if="!people.length" class="muted">
      {{ t.recipe.noHousehold }}
      <RouterLink :to="{ name: 'household' }">
        {{ t.recipe.addPeople }}
      </RouterLink>
    </p>
    <p v-else-if="!catalog.size" class="muted" role="status">
      {{ t.warnings.checking }}
    </p>
    <template v-else>
      <p v-if="!warnings.length" class="ok">
        {{ t.recipe.suitsEveryone }}
      </p>
      <p v-else-if="suited.length" class="ok">
        {{ t.recipe.suits(names(suited)) }}
      </p>
      <ul v-if="warnings.length" class="warnings">
        <li v-for="warning in warnings" :key="warningKey(warning)">
          {{ describeWarning(warning) }}
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.fit {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.fit-title {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}

.fit p {
  margin: 0;
}

.ok {
  color: var(--success);
}

.warnings {
  margin: 0.25rem 0 0;
  padding-left: 1.1rem;
  color: var(--danger);
}
</style>
