<script setup lang="ts">
import { computed } from "vue"
import { dismiss, type Toast, toasts } from "../composables/toasts"
import { useI18n } from "../i18n"

const { t } = useI18n()

const infos = computed(() => toasts.value.filter(toast => toast.tone === "info"))
const errors = computed(() => toasts.value.filter(toast => toast.tone === "error"))

function act(toast: Toast) {
  toast.action?.run()
  dismiss(toast.id)
}
</script>

<template>
  <div class="toasts no-print">
    <!-- Two regions that are always in the page, so screen readers announce what is added to them. -->
    <div role="status" aria-live="polite">
      <p v-for="toast in infos" :key="toast.id" class="toast">
        <span>{{ toast.message }}</span>
        <button v-if="toast.action" type="button" class="button small" @click="act(toast)">
          {{ toast.action.label }}
        </button>
      </p>
    </div>
    <div role="alert">
      <p v-for="toast in errors" :key="toast.id" class="toast error">
        <span>{{ toast.message }}</span>
        <button type="button" class="button small" @click="dismiss(toast.id)">
          {{ t.app.dismiss }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  left: 1rem;
  z-index: 20;
  display: grid;
  justify-items: end;
  gap: 0.5rem;
  pointer-events: none;
}

.toasts > div {
  display: grid;
  justify-items: end;
  gap: 0.5rem;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 26rem;
  margin: 0;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--success);
  border-radius: var(--radius-small);
  background: var(--surface);
  box-shadow: var(--shadow);
  pointer-events: auto;
  animation: toast-in 160ms ease-out;
}

.toast.error {
  border-left-color: var(--danger);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }
}
</style>
