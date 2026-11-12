<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "../i18n"

// Takes effect while typing. A value that isn't a whole number from 1 to 99 is flagged, never applied, and the field
// goes back to the last good value when it loses focus.
const servings = defineModel<number>({ required: true })
defineProps<{ label: string }>()
const invalid = ref(false)
const { t } = useI18n()

function input(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  invalid.value = !(Number.isInteger(value) && value >= 1 && value <= 99)
  if (!invalid.value) servings.value = value
}

function blur(event: Event) {
  (event.target as HTMLInputElement).value = String(servings.value)
  invalid.value = false
}
</script>

<template>
  <label class="servings-input">
    <input class="input" type="number" inputmode="numeric" min="1" max="99" step="1" :value="servings" :aria-invalid="invalid" @input="input" @blur="blur">
    <span>{{ label }}</span>
    <span v-if="invalid" class="error-text">{{ t.recipe.servingsRange }}</span>
  </label>
</template>

<style scoped>
.servings-input {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.5rem;
}

.input {
  width: 4.5rem;
}
</style>
