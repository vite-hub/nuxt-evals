<script setup lang="ts">
// Plain HTML bars: they render on the server and need no chart library.
// The window is the 14 UTC days up to the latest RSVP, so the server and the browser draw the same bars.
const props = defineProps<{ dates: (string | Date)[] }>()

const DAY = 24 * 60 * 60 * 1000
const WINDOW = 14

const days = computed(() => {
  if (!props.dates.length) return []
  const counts = new Map<number, number>()
  for (const date of props.dates) {
    const day = Math.floor(new Date(date).getTime() / DAY)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const last = Math.max(...counts.keys())
  return Array.from({ length: WINDOW }, (_, i) => {
    const day = last - WINDOW + 1 + i
    return { key: day, label: new Date(day * DAY).toISOString().slice(5, 10), count: counts.get(day) ?? 0 }
  })
})
const max = computed(() => Math.max(1, ...days.value.map(d => d.count)))
</script>

<template>
  <p v-if="!days.length" class="text-sm text-muted">
    No RSVPs yet.
  </p>
  <figure v-else>
    <ol class="h-40 flex items-end gap-1" aria-label="RSVPs per day, last 14 days (UTC)">
      <li v-for="day in days" :key="day.key" class="flex-1 h-full flex flex-col justify-end items-center gap-1">
        <span class="text-xs tabular-nums text-muted">{{ day.count || "" }}</span>
        <span class="w-full max-w-8 bg-primary rounded-t-(--ui-radius)" :style="{ height: `${(day.count / max) * 100}%` }" />
        <span class="text-[10px] tabular-nums text-dimmed">{{ day.label }}</span>
      </li>
    </ol>
  </figure>
</template>
