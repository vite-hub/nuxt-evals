<script setup lang="ts">
import { computed } from "vue"
import { tenScale } from "../utils/rubric"

/** A score from 0 to 10 as a colored cell, in five bands of two points: 0–2 red to 8–10 green. */
const props = defineProps<{ score: number | null | undefined, label?: string, size?: "sm" | "md" }>()
const bucket = computed(() => props.score === null || props.score === undefined || !Number.isFinite(props.score) ? undefined : Math.max(1, Math.min(5, Math.floor(props.score / 2) + 1)))
</script>

<template>
  <span
    class="score-cell"
    :class="size === 'md' ? 'h-7 min-w-9 px-1.5 text-sm font-medium' : 'h-6 w-7 text-xs'"
    :data-score="bucket"
    :title="label ? `${label}: ${tenScale(score)} of 10` : undefined"
  >
    {{ tenScale(score) }}
    <span
      v-if="label"
      class="sr-only"
    >{{ label }}</span>
  </span>
</template>
