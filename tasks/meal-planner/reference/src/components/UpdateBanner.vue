<script setup lang="ts">
import { ref } from "vue"
import { useAppUpdate } from "../composables/app-update"
import { useI18n } from "../i18n"

const { t } = useI18n()
const { waiting, updatedElsewhere, apply } = useAppUpdate()
const later = ref(false)
const reload = () => window.location.reload()
</script>

<template>
  <div v-if="updatedElsewhere" class="update no-print" role="status">
    <span>{{ t.update.elsewhere }}</span>
    <button type="button" class="button small primary" @click="reload">
      {{ t.update.reloadNow }}
    </button>
  </div>
  <div v-else-if="waiting && !later" class="update no-print" role="status">
    <span>{{ t.update.ready }}</span>
    <button type="button" class="button small primary" @click="apply">
      {{ t.update.reload }}
    </button>
    <button type="button" class="button small" @click="later = true">
      {{ t.update.later }}
    </button>
  </div>
</template>

<style scoped>
.update {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 1rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--brand-soft);
}
</style>
