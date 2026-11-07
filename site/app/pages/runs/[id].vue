<script setup lang="ts">
import { computed } from "vue"
import type { RunSummary } from "../../../shared/report"
import { day, percent, seconds, tokens } from "../../utils/format"

const route = useRoute()
const id = String(route.params.id)
const { data, error } = await useFetch<{ run: RunSummary, summary: string | null }>(`/api/runs/${id}`, { key: `run-${id}` })
if (error.value || !data.value) throw createError({ status: error.value?.statusCode ?? 404, message: "Run not found.", fatal: true })

const run = computed(() => data.value!.run)
const session = computed(() => run.value.invocation ? `/_vitehub/agents/${run.value.agent}/invocations/${run.value.invocation}` : undefined)
useSeoMeta({ title: () => `${run.value.task} #${run.value.repeat} · Nuxt agent evals` })
</script>

<template>
  <div class="pt-8">
    <NuxtLink
      to="/"
      class="enter text-sm text-dimmed transition-colors hover:text-highlighted"
    >
      ← Runs
    </NuxtLink>

    <header
      class="enter pb-4 pt-6"
      style="--i: 1"
    >
      <h1 class="text-2xl font-medium tracking-tight text-highlighted">
        {{ run.task }} #{{ run.repeat }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ run.agent }} {{ run.model }} · {{ run.reasoning }} effort · setup {{ run.setup }} · <time :datetime="run.startedAt">{{ day(run.startedAt) }} UTC</time>
      </p>
      <p class="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a
          v-if="session"
          :href="session"
          class="link"
        >Agent session</a>
        <NuxtLink
          :to="`/workspaces/${run.id}`"
          class="link"
        >Workspace</NuxtLink>
        <span class="tabular-nums text-dimmed">{{ percent(run.score) }} · {{ tokens(run.usage.inputTokens) }} in · {{ seconds(run.durationMs) }}</span>
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
