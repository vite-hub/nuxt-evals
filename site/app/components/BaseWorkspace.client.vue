<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue"
import type { CheckSource } from "#shared/rubric"
import { parentFolders, scrollToLine, selectedLines } from "../utils/file-focus"

const FileTree = defineAsyncComponent(() => import("@vite-hub/ui/file-tree").then(module => module.FileTree))
const FileView = defineAsyncComponent(() => import("@vite-hub/ui/file-view").then(module => module.FileView))

/** `focus` is a place to open, from a rubric check's source: the file, at its lines. */
const props = defineProps<{ project: string, paths: string[], focus?: CheckSource }>()

const selected = ref(props.paths.find(path => path === "README.md") ?? props.paths[0])
const lines = ref<{ start: number, end: number }>()
// The tree takes its selection when it is created, so a focused file makes a new one.
const treeKey = ref(0)
watch(() => props.focus, (focus) => {
  if (!focus || !props.paths.includes(focus.path)) return
  selected.value = focus.path
  lines.value = selectedLines(focus)
  treeKey.value++
}, { immediate: true })
const treeOptions = computed(() => ({
  density: "compact" as const,
  initialExpansion: "closed" as const,
  flattenEmptyDirectories: true,
  initialSelectedPaths: selected.value ? [selected.value] : [],
  initialExpandedPaths: selected.value ? parentFolders(selected.value) : [],
  search: true,
  onSelectionChange(selection: readonly string[]) {
    const path = selection.findLast(item => props.paths.includes(item))
    if (path && path !== selected.value) {
      selected.value = path
      lines.value = undefined
    }
  },
}))

const file = ref<{ path: string, content: string }>()
const loading = ref(false)
watch(selected, async (path) => {
  if (!path) return
  loading.value = true
  try {
    file.value = await $fetch(`/api/projects/${props.project}/file`, { query: { path } })
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

const viewer = ref<HTMLElement>()
watch([file, lines], () => {
  if (file.value?.path === selected.value && lines.value) scrollToLine(viewer.value, lines.value.start)
}, { flush: "post" })
</script>

<template>
  <div class="@container flex min-h-0 flex-1 flex-col">
  <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[21rem_minmax(0,1fr)] @min-[34rem]:grid-cols-[minmax(12rem,34%)_minmax(0,1fr)] @min-[34rem]:grid-rows-[minmax(0,1fr)]">
    <aside class="flex min-h-0 flex-col border-b border-default @min-[34rem]:border-b-0 @min-[34rem]:border-r">
      <div class="flex h-11 flex-none items-center px-4 text-xs text-muted">
        Files <span class="ml-1.5 tabular-nums text-dimmed">{{ paths.length }}</span>
      </div>
      <FileTree
        :key="treeKey"
        class="min-h-48 flex-1 overflow-auto"
        :paths="paths"
        :options="treeOptions"
      />
    </aside>
    <section class="flex min-h-0 min-w-0 flex-col">
      <div
        ref="viewer"
        class="min-h-0 flex-1 overflow-auto"
        :class="loading ? 'opacity-60' : ''"
      >
        <FileView
          v-if="file && file.path === selected"
          :file="{ name: file.path, contents: file.content }"
          :selected-lines="lines"
          :options="{ overflow: 'wrap', theme: { dark: 'github-dark-default', light: 'pierre-light' } }"
        />
      </div>
    </section>
  </div>
  </div>
</template>
