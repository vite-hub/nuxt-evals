<script setup lang="ts">
import { modelField } from "../composables/model-field"
import type { DraftError, DraftLine } from "../domain/recipe-draft"
import { units } from "../domain/units"
import { useI18n } from "../i18n"
import RowControls from "./RowControls.vue"

defineProps<{ index: number, last: boolean, error?: DraftError }>()
const { t } = useI18n()
defineEmits<{ up: [], down: [], remove: [] }>()
const line = defineModel<DraftLine>({ required: true })
const quantity = modelField(line, "quantity")
const unit = modelField(line, "unit")
const ingredient = modelField(line, "ingredient")
const note = modelField(line, "note")
</script>

<template>
  <li class="line" :data-row="line.key">
    <label class="field">
      <span>{{ t.form.amount }}</span>
      <input v-model="quantity" class="input" inputmode="decimal" autocomplete="off" :aria-invalid="error === 'amount' || error === 'needsAmount'" :aria-describedby="error ? `error-${line.key}` : undefined">
    </label>
    <label class="field">
      <span>{{ t.form.unit }}</span>
      <select v-model="unit" class="input" :aria-invalid="error === 'needsUnit'" :aria-describedby="error === 'needsUnit' ? `error-${line.key}` : undefined">
        <option v-for="item in units" :key="item" :value="item">{{ t.words.units[item] }}</option>
        <option value="">{{ t.form.toTaste }}</option>
      </select>
    </label>
    <label class="field name">
      <span>{{ t.form.ingredient }}</span>
      <input v-model="ingredient" class="input" list="ingredient-names" autocomplete="off" :aria-invalid="error === 'name'" :aria-describedby="error === 'name' ? `error-${line.key}` : undefined">
    </label>
    <label class="field note">
      <span>{{ t.form.note }} <span class="muted">{{ t.form.optional }}</span></span>
      <input v-model="note" class="input" :placeholder="t.form.notePlaceholder">
    </label>
    <RowControls :label="t.form.ingredientLabel(index + 1)" :first="index === 0" :last="last" @up="$emit('up')" @down="$emit('down')" @remove="$emit('remove')" />
    <p v-if="error" :id="`error-${line.key}`" class="error-text full">
      {{ t.form.errors[error] }}
    </p>
  </li>
</template>

<style scoped>
.line {
  display: grid;
  grid-template-columns: 6rem 7rem minmax(9rem, 2fr) minmax(7rem, 1fr) auto;
  gap: 0.5rem;
  align-items: end;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.full {
  grid-column: 1 / -1;
}

@media (max-width: 48rem) {
  .line {
    grid-template-columns: 1fr 1fr;
  }

  .name,
  .note {
    grid-column: 1 / -1;
  }
}
</style>
