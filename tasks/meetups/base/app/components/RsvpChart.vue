<script setup lang="ts">
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
    <ol class="h-40 flex items-end gap-1" aria-label="RSVPs per day (UTC), the 14 days up to the latest RSVP">
      <li v-for="(day, i) in days" :key="day.key" class="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1">
        <span class="text-xs tabular-nums text-muted">{{ day.count || "" }}</span>
        <span class="w-full max-w-8 bg-primary rounded-t-(--ui-radius)" :style="{ height: `${(day.count / max) * 100}%` }" />
        <span class="text-xs tabular-nums text-muted" :class="{ 'max-sm:invisible': i % 2 }">{{ day.label }}</span>
      </li>
    </ol>
  </figure>
</template>
