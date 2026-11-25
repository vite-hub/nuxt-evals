<script setup lang="ts">
import { useTitle } from "@vueuse/core"
import { computed, ref, useTemplateRef } from "vue"
import { usePantry } from "../composables/pantry"
import { useRecipes } from "../composables/recipes"
import { notify } from "../composables/toasts"
import { formatAmount, isPlural } from "../domain/format"
import { catalogName, countedName, findIngredient } from "../domain/ingredients"
import { addStock } from "../domain/pantry"
import { parseQuantity } from "../domain/quantity"
import { isUnit, type Unit, units } from "../domain/units"
import { focusAfterRender } from "../focus"
import { useI18n } from "../i18n"

const { t, language, wording } = useI18n()
useTitle(computed(() => t.value.app.title(t.value.pantry.title)))
const { pantry, set, remove } = usePantry()
const { catalog } = useRecipes()

const name = ref("")
const amount = ref("")
const unit = ref<Unit>("g")
const form = useTemplateRef("form")
const errors = ref<{ name?: string, amount?: string }>({})

const names = computed(() => [...catalog.value.values()].map(ingredient => catalogName(ingredient, language.value)).sort(new Intl.Collator(language.value).compare))
const items = computed(() => Object.entries(pantry.value).map(([key, stock]) => {
  const ingredient = catalog.value.get(key)
  const amount = { value: stock.quantity, unit: stock.unit }
  const name = ingredient ? catalogName(ingredient, language.value) : key
  return { key, name: stock.unit === "piece" ? countedName(key, name, isPlural(amount), wording.value) : name, amount: formatAmount(amount, wording.value) }
}).sort((a, b) => a.name.localeCompare(b.name, language.value)))

function add() {
  const ingredient = findIngredient(name.value, catalog.value)
  const quantity = parseQuantity(amount.value)
  errors.value = {
    ...(ingredient ? {} : { name: t.value.pantry.unknownIngredient }),
    ...(quantity !== null && quantity > 0 ? {} : { amount: t.value.pantry.badAmount }),
  }
  if (!ingredient || quantity === null || !(quantity > 0) || !isUnit(unit.value)) {
    void focusAfterRender("[aria-invalid='true']", form.value)
    return
  }
  const label = catalogName(ingredient, language.value)
  // More of something the pantry has adds to it; in units that can't be added, the user says which amount to keep.
  const stock = pantry.value[ingredient.id]
  const total = addStock(stock, { quantity, unit: unit.value }, ingredient)
  if (!total && !window.confirm(t.value.pantry.replaceConfirm(label))) return
  set(ingredient.id, total ?? { quantity, unit: unit.value })
  notify(stock && total ? t.value.pantry.increased(label) : t.value.pantry.added(label))
  name.value = ""
  amount.value = ""
}

function removeItem(item: { key: string, name: string }) {
  const restore = remove(item.key)
  notify(t.value.pantry.removed(item.name), "info", { label: t.value.app.undo, run: restore })
}
</script>

<template>
  <div class="page pantry">
    <h1 tabindex="-1">
      {{ t.pantry.title }}
    </h1>
    <p class="muted">
      {{ t.pantry.intro }}
    </p>
    <form ref="form" class="add card" novalidate @submit.prevent="add">
      <div class="field name">
        <label for="pantry-name">{{ t.pantry.ingredient }}</label>
        <input id="pantry-name" v-model="name" class="input" list="pantry-names" autocomplete="off" :aria-invalid="Boolean(errors.name)" :aria-describedby="errors.name ? 'pantry-name-error' : undefined">
        <datalist id="pantry-names">
          <option v-for="item in names" :key="item" :value="item" />
        </datalist>
        <p v-if="errors.name" id="pantry-name-error" class="error-text">
          {{ errors.name }}
        </p>
      </div>
      <div class="field">
        <label for="pantry-amount">{{ t.pantry.amount }}</label>
        <input id="pantry-amount" v-model="amount" class="input" inputmode="decimal" autocomplete="off" :aria-invalid="Boolean(errors.amount)" :aria-describedby="errors.amount ? 'pantry-amount-error' : undefined">
        <p v-if="errors.amount" id="pantry-amount-error" class="error-text">
          {{ errors.amount }}
        </p>
      </div>
      <label class="field">
        <span>{{ t.pantry.unit }}</span>
        <select v-model="unit" class="input">
          <option v-for="item in units" :key="item" :value="item">{{ t.words.units[item][1] }}</option>
        </select>
      </label>
      <button type="submit" class="button primary">
        {{ t.pantry.add }}
      </button>
    </form>

    <p v-if="!items.length" class="empty">
      {{ t.pantry.empty }}
    </p>
    <ul v-else class="items">
      <li v-for="item in items" :key="item.key" class="item">
        <span><strong>{{ item.name }}</strong> <span class="muted">{{ item.amount }}</span></span>
        <button type="button" class="button small" :aria-label="t.pantry.removeLabel(item.name)" @click="removeItem(item)">
          {{ t.pantry.remove }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pantry {
  max-width: 48rem;
}

.add {
  display: grid;
  grid-template-columns: minmax(12rem, 2fr) minmax(6rem, 1fr) minmax(6rem, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
  margin: 1rem 0 1.5rem;
  padding: 1rem;
}

.add .button {
  margin-top: 1.6rem;
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border);
}

.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}

@media (max-width: 40rem) {
  .add {
    grid-template-columns: 1fr 1fr;
  }

  .name {
    grid-column: 1 / -1;
  }

  .add .button {
    margin-top: 0;
    grid-column: 1 / -1;
  }
}
</style>
