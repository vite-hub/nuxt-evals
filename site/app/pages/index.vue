<script setup lang="ts">
import { computed } from "vue"
import type { RunSummary } from "../../shared/report"
import { day, percent, seconds, tokens } from "../utils/format"

const { data: runs } = await useFetch<RunSummary[]>("/api/runs", { key: "runs", default: () => [] })

/** One cell per task, agent and setup, with the median score of its runs. */
const cells = computed(() => {
  const groups = new Map<string, RunSummary[]>()
  for (const run of runs.value) {
    const key = [run.task, run.agent, run.model, run.reasoning, run.setup].join("|")
    groups.set(key, [...(groups.get(key) ?? []), run])
  }
  return [...groups.values()].map((group) => {
    const scores = group.map(run => run.score).sort((a, b) => a - b)
    const first = group[0]!
    return {
      key: [first.task, first.model, first.setup].join("-"),
      task: first.task,
      agent: `${first.model} · ${first.reasoning}`,
      setup: first.setup,
      runs: group.length,
      median: scores[Math.floor((scores.length - 1) / 2)] ?? 0,
      min: scores[0] ?? 0,
      max: scores.at(-1) ?? 0,
    }
  })
})
</script>

<template>
  <div>
    <section class="pb-6 pt-12 sm:pt-16">
      <h1 class="sr-only">
        Nuxt agent evals
      </h1>
      <div
        class="enter max-w-prose space-y-4 text-[15px] leading-7 text-pretty text-muted"
        style="--i: 1"
      >
        <p>
          Codex and Claude Code build the same Nuxt 5, Nitro v3 and h3 v2 tasks three ways: bare, with the Nuxt MCP and core skills, and with the full
          <a
            href="https://github.com/onmax/nuxt-skills"
            class="link"
          >nuxt-skills</a> plugin. Each run is graded on what the app does and on the code it leaves behind.
        </p>
        <p>
          These are dummy runs that test the pipeline. The real projects come next.
        </p>
      </div>
    </section>

    <section
      class="enter py-10"
      style="--i: 2"
    >
      <SectionLabel>Results</SectionLabel>
      <p
        v-if="!cells.length"
        class="text-sm text-muted"
      >
        No runs yet. Start one with <code class="font-mono text-highlighted">pnpm eval</code>.
      </p>
      <ul
        v-else
        class="text-sm"
      >
        <li
          v-for="cell in cells"
          :key="cell.key"
          class="row flex items-baseline gap-3 py-2.5"
        >
          <span class="font-medium text-highlighted">{{ cell.task }}</span>
          <span class="truncate text-muted">{{ cell.agent }}</span>
          <span class="text-dimmed">setup {{ cell.setup }}</span>
          <span class="ml-auto shrink-0 tabular-nums text-dimmed">{{ cell.runs }} runs</span>
          <span class="w-24 shrink-0 text-right tabular-nums">
            <span class="font-medium text-highlighted">{{ percent(cell.median) }}</span>
            <span
              v-if="cell.min !== cell.max"
              class="text-dimmed"
            > {{ percent(cell.min) }}–{{ percent(cell.max) }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section
      class="enter py-10"
      style="--i: 3"
    >
      <SectionLabel>Runs</SectionLabel>
      <ul class="text-sm">
        <li
          v-for="run in runs"
          :key="run.id"
          class="row flex items-baseline gap-3 py-2.5"
        >
          <NuxtLink
            :to="`/runs/${run.id}`"
            class="font-medium text-highlighted hover:underline hover:underline-offset-4"
          >
            {{ run.task }}
          </NuxtLink>
          <span class="hidden text-muted sm:inline">{{ run.model }} · setup {{ run.setup }}</span>
          <ScoreDot :status="run.status" />
          <span class="ml-auto hidden shrink-0 tabular-nums text-dimmed md:inline">{{ tokens((run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0)) }} tokens · {{ seconds(run.durationMs) }}</span>
          <span class="flex shrink-0 gap-3 max-md:ml-auto">
            <a
              v-if="run.invocation"
              :href="`/_vitehub/agents/${run.agent}/invocations/${run.invocation}`"
              class="link"
            >Session</a>
            <NuxtLink
              :to="`/workspaces/${run.id}`"
              class="link"
            >Workspace</NuxtLink>
          </span>
          <time
            :datetime="run.startedAt"
            class="hidden w-28 shrink-0 text-right tabular-nums text-dimmed sm:inline"
          >{{ day(run.startedAt) }}</time>
        </li>
      </ul>
    </section>
  </div>
</template>
