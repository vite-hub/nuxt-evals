<script setup lang="ts">
import { computed } from "vue"
import type { RunSummary } from "../../shared/report"

const { data: runs } = await useFetch<RunSummary[]>("/api/runs", { default: () => [] })

/** One cell per task × agent × setup, with the median score over its runs. */
const cells = computed(() => {
  const groups = new Map<string, RunSummary[]>()
  for (const run of runs.value) {
    const key = `${run.task}|${run.agent} ${run.model} (${run.reasoning})|${run.setup}`
    groups.set(key, [...(groups.get(key) ?? []), run])
  }
  return [...groups.entries()].map(([key, group]) => {
    const [task, agent, setup] = key.split("|")
    const scores = group.map(run => run.score).sort((a, b) => a - b)
    const median = scores[Math.floor((scores.length - 1) / 2)] ?? 0
    return { task, agent, setup, runs: group.length, median, min: scores[0] ?? 0, max: scores.at(-1) ?? 0 }
  })
})

const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="space-y-10">
    <section>
      <h2 class="mb-3 font-semibold">Cells</h2>
      <p v-if="!cells.length" class="text-muted">No runs yet.</p>
      <table v-else class="w-full text-sm">
        <thead class="text-left text-muted">
          <tr><th>Task</th><th>Agent</th><th>Setup</th><th>Runs</th><th>Median</th><th>Range</th></tr>
        </thead>
        <tbody>
          <tr v-for="cell in cells" :key="`${cell.task}${cell.agent}${cell.setup}`" class="border-t border-default">
            <td class="py-2">{{ cell.task }}</td>
            <td>{{ cell.agent }}</td>
            <td>{{ cell.setup }}</td>
            <td>{{ cell.runs }}</td>
            <td class="font-medium">{{ percent(cell.median) }}</td>
            <td class="text-muted">{{ percent(cell.min) }}–{{ percent(cell.max) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2 class="mb-3 font-semibold">Runs</h2>
      <table class="w-full text-sm">
        <thead class="text-left text-muted">
          <tr><th>Run</th><th>Setup</th><th>Status</th><th>Score</th><th>Tokens</th><th>Time</th></tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id" class="border-t border-default">
            <td class="py-2"><NuxtLink :to="`/runs/${run.id}`" class="text-primary">{{ run.task }} #{{ run.repeat }}</NuxtLink> <span class="text-muted">{{ run.model }}</span></td>
            <td>{{ run.setup }}</td>
            <td><UBadge :color="run.status === 'passed' ? 'success' : run.status === 'failed' ? 'warning' : 'error'" variant="soft">{{ run.status }}</UBadge></td>
            <td>{{ percent(run.score) }}</td>
            <td>{{ ((run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0)).toLocaleString("en") }}</td>
            <td>{{ Math.round(run.durationMs / 1000) }} s</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
