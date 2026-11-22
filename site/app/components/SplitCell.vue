<script setup lang="ts">
import { scoreText } from "../utils/rubric"

/**
 * Two scores in one box, cut by a line at 15°: without skills on the left, with skills on the right. Each half takes
 * the color band of its own score, as ScoreCell does; a side with no runs stays gray with a dash. `sm` fits the
 * breakdown columns; the slots replace a half's number, as the legend does.
 */
defineProps<{
  size?: "sm" | "md"
  bare: number | null | undefined
  skills: number | null | undefined
  /** Tooltip and screen-reader text for each half. */
  bareLabel: string
  skillsLabel: string
}>()

const bucket = (score: number | null | undefined) => score === null || score === undefined || !Number.isFinite(score) ? undefined : Math.max(1, Math.min(5, Math.floor(score / 2) + 1))
/** "100" is a digit wider than the half leaves room for before the cut. */
const wide = (score: number | null | undefined) => scoreText(score).length > 2
</script>

<template>
  <span
    class="split-cell"
    :class="size === 'sm' && 'sm'"
  >
    <span
      class="split-half bare"
      :class="wide(bare) && 'wide'"
      :data-score="bucket(bare)"
      :title="bareLabel"
    ><slot name="bare">{{ scoreText(bare) }}</slot><span class="sr-only">{{ bareLabel }}</span></span>
    <span
      class="split-half skills"
      :class="wide(skills) && 'wide'"
      :data-score="bucket(skills)"
      :title="skillsLabel"
    ><slot name="skills">{{ scoreText(skills) }}</slot><span class="sr-only">{{ skillsLabel }}</span></span>
  </span>
</template>

<style scoped>
.split-cell {
  position: relative;
  display: inline-block;
  width: 5rem;
  height: 2rem;
  font-size: 0.875rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  --pad: 0.6rem;
}

.split-cell.sm {
  width: 3.75rem;
  height: 1.75rem;
  font-size: 0.8125rem;
  --pad: 0.4rem;
}

/* tan(15°) × 2rem is about 10% of the width, so the cut runs from 55% at the top to 45% at the bottom. */
.split-half {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  color: var(--score-ink);
  background: var(--score-none);
}

.bare {
  justify-content: flex-start;
  padding-left: var(--pad);
  border-radius: 2px 0 0 2px;
  clip-path: polygon(0 0, calc(55% - 1.5px) 0, calc(45% - 1.5px) 100%, 0 100%);
}

.skills {
  justify-content: flex-end;
  padding-right: var(--pad);
  border-radius: 0 2px 2px 0;
  clip-path: polygon(calc(55% + 1.5px) 0, 100% 0, 100% 100%, calc(45% + 1.5px) 100%);
}

/* Three digits sit closer to the edge, and in the small cell a size smaller, so the cut doesn't clip one. */
.split-half.wide {
  --pad: 0.4rem;
}

.sm .split-half.wide {
  --pad: 0.25rem;
  font-size: 0.6875rem;
}

.split-half[data-score="5"] { background: var(--score-5); }
.split-half[data-score="4"] { background: var(--score-4); }
.split-half[data-score="3"] { background: var(--score-3); }
.split-half[data-score="2"] { background: var(--score-2); }
.split-half[data-score="1"] { background: var(--score-1); }
</style>
