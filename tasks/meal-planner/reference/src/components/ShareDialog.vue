<script setup lang="ts">
import { computedAsync, useClipboard } from "@vueuse/core"
import { useRouter } from "vue-router"
import { notify } from "../composables/toasts"
import { encodeWeek, type SharedWeek } from "../domain/share"
import { useI18n } from "../i18n"
import AppDialog from "./AppDialog.vue"

const props = defineProps<{ week: SharedWeek }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const router = useRouter()
const link = computedAsync(async () => new URL(router.resolve({ name: "shared", hash: `#${await encodeWeek(props.week)}` }).href, window.location.origin).href, "")
const { copy, isSupported } = useClipboard({ legacy: true })

async function copyLink() {
  await copy(link.value)
  notify(t.value.plan.shareCopied)
}
</script>

<template>
  <AppDialog v-slot="{ close }" :title="t.plan.share" @close="emit('close')">
    <div class="share">
      <label class="field">
        <span>{{ t.plan.shareReady }}</span>
        <input class="input" readonly :value="link" @focus="($event.target as HTMLInputElement).select()">
      </label>
      <div class="toolbar">
        <button v-if="isSupported" type="button" class="button primary" :disabled="!link" @click="copyLink">
          {{ t.plan.copyLink }}
        </button>
        <button type="button" class="button" @click="close">
          {{ t.app.close }}
        </button>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.share {
  display: grid;
  gap: 1rem;
}
</style>
