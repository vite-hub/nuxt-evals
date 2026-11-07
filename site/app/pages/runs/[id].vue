<script setup lang="ts">
import { computed } from "vue"
import { consoleAgentName, type RunSummary } from "#shared/report"
import { harnessLabel, modelLabel, projectLabel } from "#shared/labels"
import type { SessionView, WorkspaceView } from "#shared/report"
import { day, money, percent, seconds, tokens } from "../../utils/format"

definePageMeta({ bleed: true })

const route = useRoute()
const id = String(route.params.id)
const { data, error } = await useFetch<{ run: RunSummary, summary: string | null }>(`/api/runs/${id}`, { key: `run-${id}` })
if (error.value || !data.value) throw createError({ status: error.value?.statusCode ?? 404, message: "Run not found.", fatal: true })

const run = computed(() => data.value!.run)
const consoleUrl = computed(() => run.value.invocation ? `/_vitehub/agents/${consoleAgentName}/invocations/${run.value.invocation}` : undefined)
// The session and its files are large and only matter once someone reads them, so the browser loads them.
const { data: session, status: sessionStatus } = useFetch<SessionView>(`/api/runs/${id}/session`, { key: `run-session-${id}`, server: false, lazy: true })
const { data: workspace, status: workspaceStatus } = useFetch<WorkspaceView>(`/api/runs/${id}/workspace`, { key: `run-workspace-${id}`, server: false, lazy: true })

useSeoMeta({ title: () => `${projectLabel(run.value.project)} · ${harnessLabel(run.value.harness)} ${run.value.setup}${run.value.repeat} · Nuxt agent evals` })
</script>

<template>
  <div>
    <div class="mx-auto max-w-3xl px-6 pt-8">
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
          v-if="consoleUrl"
          :href="consoleUrl"
          class="link"
        >Open in the Console</a>
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

  <section
    aria-label="Session and files"
    class="border-t border-default"
  >
    <div class="grid lg:h-[calc(100svh-3.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div class="flex min-h-[28rem] flex-col border-default max-lg:border-b lg:min-h-0 lg:border-r">
        <h2 class="flex h-10 shrink-0 items-center border-b border-default px-4 text-sm font-medium text-highlighted">
          Session
        </h2>
        <RunSession
          v-if="session"
          :session="session"
          class="min-h-0 flex-1"
        />
        <p
          v-else
          class="px-4 py-6 text-sm text-muted"
        >
          {{ sessionStatus === "error" ? "This run has no session file." : "Loading the session…" }}
        </p>
      </div>
      <div class="flex min-h-[28rem] flex-col lg:min-h-0">
        <h2 class="flex h-10 shrink-0 items-center gap-2 border-b border-default px-4 text-sm font-medium text-highlighted">
          Workspace
          <span
            v-if="workspace"
            class="font-mono text-xs font-normal text-dimmed"
          >{{ workspace.ref }} · {{ workspace.revision.slice(0, 8) }}</span>
        </h2>
        <RunWorkspace
          v-if="workspace"
          :run-id="id"
          :workspace="workspace"
        />
        <p
          v-else
          class="px-4 py-6 text-sm text-muted"
        >
          {{ workspaceStatus === "error" ? "This run has no files in the Workspace." : "Loading the files…" }}
        </p>
      </div>
    </div>
  </section>
  </div>
</template>
