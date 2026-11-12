<script setup lang="ts">
import { useSettings } from "../composables/settings"
import type { UnitSystem } from "../domain/types"
import { useI18n } from "../i18n"

const { units } = useSettings()
const { t } = useI18n()
const options: UnitSystem[] = ["metric", "us"]
</script>

<template>
  <fieldset class="unit-toggle">
    <legend class="visually-hidden">{{ t.settings.units }}</legend>
    <span class="label" aria-hidden="true">{{ t.settings.units }}</span>
    <label v-for="option in options" :key="option" class="option">
      <input v-model="units" type="radio" name="units" :value="option">
      <span>{{ t.settings[option] }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.unit-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.label {
  margin-right: 0.35rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.option {
  cursor: pointer;
}

/* The radio stays in the page for keyboards and screen readers; its label is the visible button. */
.option input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
}

.option span {
  display: inline-block;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-small);
}

.option input:checked + span {
  border-color: var(--brand-strong);
  background: var(--brand-strong);
  color: var(--on-brand);
}

.option input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>
