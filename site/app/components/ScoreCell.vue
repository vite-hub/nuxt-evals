<script setup lang="ts">
import { computed } from "vue"
import { fiveScale } from "../utils/rubric"

/** One section score, 1 to 5, as a colored cell. A median between two scores takes the lower color. */
const props = defineProps<{ score: number | null | undefined, label?: string, size?: "sm" | "md" }>()
const bucket = computed(() => props.score === null || props.score === undefined ? undefined : Math.max(1, Math.min(5, Math.floor(props.score))))
</script>

<template>
  <span
    class="score-cell"
    :class="size === 'md' ? 'h-7 min-w-9 px-1.5 text-sm font-medium' : 'h-6 min-w-6 px-1 text-[11px]'"
    :data-score="bucket"
    :title="label ? `${label}: ${fiveScale(score)} of 5` : undefined"
  >
    {{ fiveScale(score) }}
    <span
      v-if="label"
      class="sr-only"
    >{{ label }}</span>
  </span>
</template>
