<script setup lang="ts">
import { computed } from "vue"
import { scoreText } from "../utils/rubric"

/** A score (stored 0 to 10, shown 0 to 100) as a colored cell, in five bands of 20 points: 0–20 red to 80–100 green. */
const props = defineProps<{ score: number | null | undefined, label?: string, size?: "sm" | "md" }>()
const bucket = computed(() => props.score === null || props.score === undefined || !Number.isFinite(props.score) ? undefined : Math.max(1, Math.min(5, Math.floor(props.score / 2) + 1)))
</script>

<template>
  <span
    class="score-cell"
    :class="size === 'md' ? 'h-7 min-w-9 px-1.5 text-sm font-medium' : 'h-6 w-7 text-xs'"
    :data-score="bucket"
    :title="label ? `${label}: ${scoreText(score)} of 100` : undefined"
  >
    {{ scoreText(score) }}
    <span
      v-if="label"
      class="sr-only"
    >{{ label }}</span>
  </span>
</template>
