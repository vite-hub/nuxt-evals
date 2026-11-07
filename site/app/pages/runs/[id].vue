<script setup lang="ts">
import { computed } from "vue"
import { consoleAgentName, type RunSummary } from "#shared/report"
import { harnessLabel, modelLabel, projectLabel } from "#shared/labels"
import { day, money, percent, seconds, tokens } from "../../utils/format"

const route = useRoute()
const id = String(route.params.id)
const { data, error } = await useFetch<{ run: RunSummary, summary: string | null }>(`/api/runs/${id}`, { key: `run-${id}` })
if (error.value || !data.value) throw createError({ status: error.value?.statusCode ?? 404, message: "Run not found.", fatal: true })

const run = computed(() => data.value!.run)
const session = computed(() => run.value.invocation ? `/_vitehub/agents/${consoleAgentName}/invocations/${run.value.invocation}` : undefined)
useSeoMeta({ title: () => `${projectLabel(run.value.project)} · ${harnessLabel(run.value.harness)} ${run.value.setup}${run.value.repeat} · Nuxt agent evals` })
</script>

<template>
  <div class="pt-8">
    <NuxtLink
      to="/"
      class="enter text-sm text-dimmed transition-colors hover:text-highlighted"
    >
      ← Results
    </NuxtLink>

    <header
      class="enter pb-4 pt-6"
      style="--i: 1"
    >
      <h1 class="text-2xl font-medium tracking-tight text-highlighted">
        {{ projectLabel(run.project) }} · {{ harnessLabel(run.harness) }} {{ run.setup }}{{ run.repeat }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ modelLabel(run.model) }} · {{ run.reasoning }} effort · setup {{ run.setup }} · <time :datetime="run.startedAt">{{ day(run.startedAt) }} UTC</time>
      </p>
      <p class="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a
          v-if="session"
          :href="session"
          class="link"
        >Session, thinking and files</a>
        <span class="tabular-nums text-dimmed">{{ percent(run.score) }} · {{ money(Number(run.usage.costUsd ?? 0)) }} · {{ tokens(run.usage.totalTokens ?? run.usage.inputTokens) }} tokens · {{ seconds(run.durationMs) }}</span>
      </p>
    </header>

    <section
      class="enter py-6"
      style="--i: 2"
    >
      <RunSummary
        v-if="data?.summary"
        :markdown="data.summary"
      />
      <p
        v-else
        class="text-sm text-muted"
      >
        This run has no summary yet.
      </p>
    </section>
  </div>
</template>
