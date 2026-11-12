<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef } from "vue"

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef("dialog")

// A native modal dialog: it traps focus and closes on Escape. Its parent unmounts it when it closes, also through the
// browser's Back, so focus goes back to the control that opened it by hand.
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => void nextTick(() => opener?.isConnected && opener.focus()))
const close = () => dialog.value?.close()
</script>

<template>
  <dialog ref="dialog" class="dialog card" :aria-label="title" @close="emit('close')">
    <h2 class="dialog-title">
      {{ title }}
    </h2>
    <slot :close="close" />
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(30rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  padding: 1.25rem;
  color: var(--text);
}

.dialog::backdrop {
  background: rgb(0 0 0 / 45%);
}

.dialog-title {
  margin: 0 0 1rem;
  font-size: 1.2rem;
}
</style>
