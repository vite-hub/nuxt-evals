<script setup lang="ts">
import { BarController, BarElement, CategoryScale, Chart, LinearScale } from "chart.js"

const props = defineProps<{ days: { date: string, count: number }[] }>()
const canvas = useTemplateRef("canvas")
let chart: Chart | undefined

onMounted(() => {
  Chart.register(BarController, BarElement, CategoryScale, LinearScale)
  chart = new Chart(canvas.value!, {
    type: "bar",
    data: {
      labels: props.days.map(day => day.date.slice(5)),
      datasets: [{ label: "RSVPs", data: props.days.map(day => day.count), backgroundColor: "#10b981" }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  })
})

onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="h-64">
    <canvas ref="canvas" />
  </div>
</template>
