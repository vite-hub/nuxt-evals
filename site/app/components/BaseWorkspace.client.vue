<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue"

const FileTree = defineAsyncComponent(() => import("@vite-hub/ui/file-tree").then(module => module.FileTree))
const FileView = defineAsyncComponent(() => import("@vite-hub/ui/file-view").then(module => module.FileView))

const props = defineProps<{ project: string, paths: string[] }>()

const selected = ref(props.paths.find(path => path === "README.md") ?? props.paths[0])
const treeOptions = computed(() => ({
  density: "compact" as const,
  initialExpansion: "closed" as const,
  flattenEmptyDirectories: true,
  initialSelectedPaths: selected.value ? [selected.value] : [],
  search: true,
  onSelectionChange(selection: readonly string[]) {
    const path = selection.findLast(item => props.paths.includes(item))
    if (path) selected.value = path
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
</script>

<template>
  <div class="@container flex min-h-0 flex-1 flex-col">
  <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[18rem_minmax(0,1fr)] @min-[34rem]:grid-cols-[minmax(12rem,34%)_minmax(0,1fr)] @min-[34rem]:grid-rows-[minmax(0,1fr)]">
    <aside class="flex min-h-0 flex-col border-b border-default @min-[34rem]:border-b-0 @min-[34rem]:border-r">
      <div class="flex h-11 flex-none items-center px-4 text-xs text-muted">
        Files <span class="ml-1.5 tabular-nums text-dimmed">{{ paths.length }}</span>
      </div>
      <FileTree
        class="min-h-48 flex-1 overflow-auto"
        :paths="paths"
        :options="treeOptions"
      />
    </aside>
    <section class="flex min-h-0 min-w-0 flex-col">
      <div
        class="min-h-0 flex-1 overflow-auto"
        :class="loading ? 'opacity-60' : ''"
      >
        <FileView
          v-if="file && file.path === selected"
          :file="{ name: file.path, contents: file.content }"
          :options="{ overflow: 'wrap', theme: { dark: 'github-dark-default', light: 'pierre-light' } }"
        />
      </div>
    </section>
  </div>
  </div>
</template>
