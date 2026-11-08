<script setup lang="ts">
import { computed } from "vue"
import { consoleAgentName, type RunSummary } from "#shared/report"
import { harnessLabel, projectLabel } from "#shared/labels"
import type { SessionView, WorkspaceView } from "#shared/report"

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
  <div class="h-[calc(100svh-3.5rem)] min-h-[32rem]">
    <RunAgentSession
      :run="run"
      :summary="data?.summary ?? null"
      :console-url="consoleUrl"
      :session="session"
      :session-status="sessionStatus"
      :workspace="workspace"
      :workspace-status="workspaceStatus"
    />
  </div>
</template>
