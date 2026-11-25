<script setup lang="ts">
import { modelField } from "../composables/model-field"
import type { DraftStep } from "../domain/recipe-draft"
import { useI18n } from "../i18n"
import RowControls from "./RowControls.vue"

defineProps<{ index: number, last: boolean, invalid: boolean }>()
defineEmits<{ up: [], down: [], remove: [] }>()
const step = defineModel<DraftStep>({ required: true })
const text = modelField(step, "text")
const { t } = useI18n()
</script>

<template>
  <li class="step" :data-row="step.key">
    <label class="field">
      <span>{{ t.form.step(index + 1) }}</span>
      <textarea v-model="text" class="input" rows="2" :aria-invalid="invalid" />
    </label>
    <RowControls :label="t.form.stepLabel(index + 1)" :first="index === 0" :last="last" @up="$emit('up')" @down="$emit('down')" @remove="$emit('remove')" />
  </li>
</template>

<style scoped>
.step {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: end;
}
</style>
