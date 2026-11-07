<script setup lang="ts">
import { Chart } from "chart.js"

const props = defineProps<{ days: { date: string, count: number }[] }>()
const canvas = useTemplateRef("canvas")

onMounted(() => {
  new Chart(canvas.value!, {
    type: "bar",
    data: { labels: props.days.map(day => day.date.slice(5)), datasets: [{ label: "RSVPs", data: props.days.map(day => day.count) }] },
  })
})
</script>

<template>
  <canvas ref="canvas" />
</template>
