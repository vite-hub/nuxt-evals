<script setup lang="ts">
import { computed } from "vue"
import type { ProjectView, RunSummary } from "#shared/report"

definePageMeta({ bleed: true })

const route = useRoute()
const name = String(route.params.project)
const { data, error } = await useFetch<ProjectView>(`/api/projects/${name}`, { key: `project-${name}` })
if (error.value || !data.value) throw createError({ status: error.value?.statusCode ?? 404, message: "Project not found.", fatal: true })
const { data: runs } = await useFetch<RunSummary[]>("/api/runs", { key: "runs", default: () => [] })
const projectRuns = computed(() => runs.value.filter(run => run.project === name))

useSeoMeta({ title: () => `${data.value!.title} · starting app · Nuxt agent evals` })
</script>

<template>
  <div class="h-[calc(100svh-3.25rem)] min-h-[32rem]">
    <ProjectBase
      :project="data!"
      :runs="projectRuns"
    />
  </div>
</template>
