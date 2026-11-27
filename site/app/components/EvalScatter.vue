<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue"
import { harnessColor } from "#shared/harnesses"

export interface ScatterPoint {
  id: string
  group: string
  x: number
  y: number
  /** The harness id, whose tone colors the mark (`harnessColor`). */
  tone: string
  /** A CSS color that overrides the harness tone, when one harness has several agents. */
  color?: string
  /** Without skills a mark is a ring, with skills a filled dot. */
  hollow?: boolean
}

export interface ScatterGroup {
  key: string
  label: string
  x: number
  y: number
  tone: string
  color?: string
  hollow?: boolean
}

const props = defineProps<{
  points: ScatterPoint[]
  groups: ScatterGroup[]
  xLabel: string
  log: boolean
  format: (value: number) => string
  /** The score axis. Probe projects show a percent; rubric projects the 0-to-10 score. */
  yFormat?: (value: number) => string
  /** Score gridlines, 0 to 1. Rubric projects use 0 to 10 in steps of 2. */
  yTicks?: number[]
}>()

const emit = defineEmits<{ open: [id: string] }>()

const frame = useTemplateRef<HTMLElement>("frame")
const measured = ref(0)
const measuredHeight = ref(0)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    measured.value = entry!.contentRect.width
    measuredHeight.value = entry!.contentRect.height
  })
  observer.observe(frame.value!)
})
onBeforeUnmount(() => observer?.disconnect())
const width = computed(() => measured.value || 960)
const height = computed(() => Math.max(320, measuredHeight.value || 480))
// Below 640 px the group labels leave the chart for a list under it; the medians stay.
const narrow = computed(() => width.value < 640)
const pad = computed(() => ({ top: 24, right: narrow.value ? 16 : 220, bottom: 56, left: 48 }))

const domain = computed<[number, number]>(() => {
  // The overview plots only medians, so they set the axis when there are no runs.
  const values = (props.points.length ? props.points : props.groups).map(point => point.x).filter(value => Number.isFinite(value) && (!props.log || value > 0))
  if (!values.length) return props.log ? [0.01, 1] : [0, 1]
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (props.log) return [min / 1.6, max * 1.6]
  const span = max - min || max || 1
  return [Math.max(0, min - span * 0.2), max + span * 0.2]
})

function sx(value: number): number {
  const [min, max] = domain.value
  const inner = width.value - pad.value.left - pad.value.right
  const ratio = props.log ? (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (value - min) / (max - min)
  return pad.value.left + Math.min(1, Math.max(0, ratio)) * inner
}

function sy(score: number): number {
  return pad.value.top + (1 - score) * (height.value - pad.value.top - pad.value.bottom)
}

/** Ticks at 1, 2 and 5 of each decade on a log axis, five even steps on a linear one. */
const ticks = computed(() => {
  const [min, max] = domain.value
  if (!props.log) return Array.from({ length: 6 }, (_, index) => min + (max - min) * index / 5)
  const result: number[] = []
  // A narrow range (all runs within one decade) needs every multiple to show more than one tick.
  const steps = max / min < 5 ? [1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9] : max / min < 20 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 5]
  for (let decade = 10 ** Math.floor(Math.log10(min)); decade <= max; decade *= 10) {
    for (const step of steps) {
      const value = decade * step
      if (value >= min && value <= max) result.push(value)
    }
  }
  // Keep ticks at least 64 px apart so their labels never touch.
  let last = -Infinity
  return result.filter((value) => {
    const x = sx(value)
    if (x - last < 64) return false
    last = x
    return true
  })
})

/** A mark's color: its own, or its harness's tone. A ring takes it as its stroke, a dot as its fill. */
const markStyle = (mark: { tone: ScatterPoint["tone"], color?: string, hollow?: boolean }) => {
  const color = mark.color ?? harnessColor(mark.tone)
  return mark.hollow ? { stroke: color } : { fill: color }
}

/** Group labels sit in the right gutter, pushed apart so they never overlap, with a leader line to their median. */
const labels = computed(() => {
  const sorted = [...props.groups].sort((a, b) => b.y - a.y || a.label.localeCompare(b.label))
  let last = -Infinity
  return sorted.map((group) => {
    const y = Math.max(sy(group.y), last + 20)
    last = y
    return { ...group, px: sx(group.x), py: sy(group.y), ly: y }
  })
})
</script>

<template>
  <div
    ref="frame"
    class="relative size-full min-h-80"
  >
    <svg
      :width="width"
      :height="height"
      class="absolute inset-0 overflow-visible"
      role="img"
      :aria-label="`Score against ${xLabel}`"
    >
      <g class="text-[11px] tabular-nums">
        <g
          v-for="score in yTicks ?? [0, 0.25, 0.5, 0.75, 1]"
          :key="score"
        >
          <line
            :x1="pad.left"
            :x2="width - pad.right"
            :y1="sy(score)"
            :y2="sy(score)"
            class="stroke-(--ui-border)"
            stroke-dasharray="2 4"
          />
          <text
            :x="pad.left - 12"
            :y="sy(score)"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-(--ui-text-dimmed)"
          >{{ yFormat ? yFormat(score) : `${Math.round(score * 100)}%` }}</text>
        </g>
        <text
          v-for="tick in ticks"
          :key="tick"
          :x="sx(tick)"
          :y="height - pad.bottom + 22"
          text-anchor="middle"
          class="fill-(--ui-text-dimmed)"
        >{{ format(tick) }}</text>
        <line
          :x1="pad.left"
          :x2="width - pad.right"
          :y1="height - pad.bottom"
          :y2="height - pad.bottom"
          class="stroke-(--ui-border-accented)"
        />
        <text
          :x="pad.left + (width - pad.left - pad.right) / 2"
          :y="height - 8"
          text-anchor="middle"
          class="fill-(--ui-text-muted) text-xs"
        >{{ xLabel }}</text>
        <text
          :x="pad.left - 12"
          :y="pad.top - 12"
          text-anchor="end"
          class="fill-(--ui-text-muted) text-xs"
        >Score</text>
      </g>

      <g>
        <circle
          v-for="point in points"
          :key="point.id"
          :cx="sx(point.x)"
          :cy="sy(point.y)"
          r="4"
          class="dot cursor-pointer"
          :class="{ hollow: point.hollow }"
          :style="markStyle(point)"
          @click="emit('open', point.id)"
        >
          <title>{{ point.group }}: {{ yFormat ? yFormat(point.y) : `${Math.round(point.y * 100)}%` }}, {{ format(point.x) }}</title>
        </circle>
      </g>

      <g
        v-for="label in labels"
        :key="label.key"
        class="text-[13px]"
      >
        <line
          v-if="!narrow"
          :x1="label.px"
          :y1="label.py"
          :x2="width - pad.right + 12"
          :y2="label.ly"
          class="stroke-(--ui-border)"
        />
        <circle
          :cx="label.px"
          :cy="label.py"
          r="6"
          class="median"
          :class="{ hollow: label.hollow }"
          :style="markStyle(label)"
        />
        <text
          v-if="!narrow"
          :x="width - pad.right + 18"
          :y="label.ly"
          dominant-baseline="middle"
          class="font-medium"
          :style="{ fill: label.color ?? harnessColor(label.tone) }"
        >{{ label.label }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.dot {
  fill-opacity: 0.55;
  transition: fill-opacity 150ms ease, r 150ms ease;
}

@media (hover: hover) {
  .dot:hover {
    fill-opacity: 1;
    r: 6;
  }
}

.median {
  stroke: var(--ui-bg);
  stroke-width: 2;
}

/* A ring: the background shows through, so a hollow mark over a filled one still reads. */
.dot.hollow,
.median.hollow {
  fill: var(--ui-bg);
  fill-opacity: 1;
  stroke-width: 2;
}

.dot.hollow {
  stroke-opacity: 0.7;
  stroke-width: 1.5;
}

@media (hover: hover) {
  .dot.hollow:hover {
    stroke-opacity: 1;
  }
}
</style>
