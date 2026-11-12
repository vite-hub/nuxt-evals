<script setup lang="ts">
// The move buttons stay focusable at the ends (aria-disabled, not disabled), so focus isn't lost when a row reaches the top.
// `data-action` lets the list put focus back on the same button once the row has moved.
import { useI18n } from "../i18n"

defineProps<{ label: string, first: boolean, last: boolean }>()
defineEmits<{ up: [], down: [], remove: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="row-controls">
    <button type="button" class="button small icon-button" :aria-disabled="first" :aria-label="t.form.moveUp(label)" data-action="up" @click="$emit('up')">
      <span aria-hidden="true">↑</span>
    </button>
    <button type="button" class="button small icon-button" :aria-disabled="last" :aria-label="t.form.moveDown(label)" data-action="down" @click="$emit('down')">
      <span aria-hidden="true">↓</span>
    </button>
    <button type="button" class="button small danger" :aria-label="t.form.removeLabel(label)" data-action="remove" @click="$emit('remove')">
      {{ t.form.remove }}
    </button>
  </div>
</template>

<style scoped>
.row-controls {
  display: flex;
  gap: 0.3rem;
  align-items: end;
}
</style>
