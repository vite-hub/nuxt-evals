<script setup lang="ts">
import { computed } from "vue"
import type { RunFile } from "../../../shared/report"
import { day } from "../../utils/format"

definePageMeta({ wide: true })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const { data: list } = await useFetch<{ id: string, task: string, model: string, setup: string, status: string, startedAt: string }[]>("/api/workspaces", { key: "workspaces", default: () => [] })
const { data: workspace, error } = await useFetch<{ files: RunFile[], diff: string }>(() => `/api/workspaces/${id.value}`, { key: () => `workspace-${id.value}` })
if (error.value) throw createError({ status: error.value.statusCode ?? 404, message: "Workspace not found.", fatal: true })

const workspaces = computed(() => list.value.map(item => ({
  id: item.id,
  label: `${item.model} · setup ${item.setup}`,
  detail: `${day(item.startedAt)} · ${item.status}`,
  group: item.task,
  to: `/workspaces/${item.id}`,
})))
const changed = computed(() => [...(workspace.value?.diff ?? "").matchAll(/^\+\+\+ b\/(.+)$/gm)].map(match => match[1]!))
const file = computed(() => typeof route.query.file === "string" ? route.query.file : changed.value[0])

useSeoMeta({ title: "Workspaces · Nuxt agent evals" })
</script>

<template>
  <div class="pt-8">
    <div class="enter mb-6 flex items-baseline justify-between gap-4">
      <h1 class="text-2xl font-medium tracking-tight text-highlighted">
        Workspaces
      </h1>
      <NuxtLink
        :to="`/runs/${id}`"
        class="link text-sm"
      >
        Run summary
      </NuxtLink>
    </div>
    <WorkspaceBrowser
      class="enter"
      style="--i: 1"
      :workspaces="workspaces"
      :active="id"
      :files="workspace?.files ?? []"
      :file="file"
      :changed="changed"
      @select-file="path => router.replace({ query: { ...route.query, file: path } })"
    />
  </div>
</template>
