<script setup lang="ts">
import type { ProjectView, RunSummary } from "#shared/report"
import { projectLabel, projectStack, projectSummary } from "#shared/labels"

/** Every project with graded runs, the one with the most runs first, with its checks and runs. Only the counts reach the page. */
const { data: projects } = await useAsyncData("project-list", async () => {
  const runs = await $fetch<RunSummary[]>("/api/runs")
  const counts = new Map<string, number>()
  for (const run of runs) if (run.rubric) counts.set(run.project, (counts.get(run.project) ?? 0) + 1)
  const ids = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b))
  const views = await Promise.all(ids.map(id => $fetch<ProjectView>(`/api/projects/${id}`)))
  return ids.map((id, index) => ({ id, runs: counts.get(id)!, checks: views[index]!.rubric?.checks.length ?? null }))
}, { default: () => [] })
</script>

<template>
  <ul class="flex flex-col gap-5">
    <li
      v-for="project in projects"
      :key="project.id"
    >
      <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
        <StackLogos :project="project.id" />
        <span class="font-medium text-highlighted">{{ projectLabel(project.id) }}</span>
        <span
          v-if="projectStack(project.id)"
          class="rounded-sm bg-elevated px-1.5 text-xs leading-5 text-muted"
        >{{ projectStack(project.id) }}</span>
      </p>
      <p
        v-if="projectSummary(project.id)"
        class="mt-1 leading-7 text-pretty text-default"
      >
        {{ projectSummary(project.id) }}
      </p>
      <p class="mt-1 text-sm text-muted">
        <template v-if="project.checks">
          {{ project.checks }} checks ·
        </template>
        {{ project.runs === 1 ? "1 graded run" : `${project.runs} graded runs` }} ·
        <NuxtLink
          :to="`/projects/${project.id}`"
          class="text-default underline decoration-dimmed underline-offset-2 transition-colors hover:text-highlighted"
        >The prompt, the rubric and the reference app</NuxtLink>
      </p>
    </li>
  </ul>
</template>
