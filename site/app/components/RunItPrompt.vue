<script setup lang="ts">
import prompt from "~/assets/run-it-prompt.md?raw"

const open = ref(false)
const copied = ref(false)
let reset: ReturnType<typeof setTimeout> | undefined

async function copy() {
  await navigator.clipboard.writeText(prompt.trim())
  copied.value = true
  clearTimeout(reset)
  reset = setTimeout(() => copied.value = false, 2000)
}
</script>

<template>
  <section class="rounded-lg border border-default">
    <div class="flex items-center justify-between gap-3 py-2 pr-2 pl-4">
      <p class="text-sm font-medium text-highlighted">
        Or paste this prompt into your agent
      </p>
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :label="copied ? 'Copied' : 'Copy prompt'"
        color="neutral"
        variant="outline"
        size="sm"
        @click="copy"
      />
    </div>
    <div
      id="run-it-prompt"
      class="relative overflow-hidden px-4 text-sm/6 text-muted"
      :class="open ? '' : 'max-h-24'"
    >
      <p
        class="whitespace-pre-wrap"
        v-text="prompt.trim()"
      />
      <div
        v-if="!open"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-default to-transparent"
      />
    </div>
    <div class="px-2 pt-1 pb-2">
      <UButton
        :label="open ? 'Show less' : 'Read more'"
        :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        color="neutral"
        variant="link"
        size="sm"
        aria-controls="run-it-prompt"
        :aria-expanded="open"
        @click="open = !open"
      />
    </div>
  </section>
</template>
