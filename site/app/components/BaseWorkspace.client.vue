<script setup lang="ts">
import { defineAsyncComponent, nextTick, ref, watch } from "vue"
import type { CheckSource } from "#shared/rubric"
import { selectedLines } from "../utils/file-focus"

const FileTree = defineAsyncComponent(() => import("@vite-hub/ui").then(module => module.FileTree))
const FileView = defineAsyncComponent(() => import("@vite-hub/ui").then(module => module.FileView))

/** `focus` is a place to open, from a rubric check's source: the file, at its lines. */
const props = defineProps<{ project: string, paths: string[], focus?: CheckSource }>()

const selected = ref(props.paths.find(path => path === "README.md") ?? props.paths[0])
const lines = ref<{ start: number, end: number }>()
watch(() => props.focus, async (focus) => {
  if (!focus || !props.paths.includes(focus.path)) return
  selected.value = focus.path
  // The viewer scrolls to a range one time. Clear it, so a link that is clicked again scrolls again.
  lines.value = undefined
  await nextTick()
  lines.value = selectedLines(focus)
}, { immediate: true })
// A file that the reader picks in the tree opens at its top. The page puts it in the address.
const emit = defineEmits<{ pick: [path: string] }>()
function pick(path: string) {
  selected.value = path
  lines.value = undefined
  emit("pick", path)
}
const treeOptions = {
  density: "compact" as const,
  initialExpansion: "closed" as const,
  flattenEmptyDirectories: true,
  search: true,
}

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
  <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[21rem_minmax(0,1fr)] @min-[34rem]:grid-cols-[minmax(12rem,34%)_minmax(0,1fr)] @min-[34rem]:grid-rows-[minmax(0,1fr)]">
    <aside class="flex min-h-0 flex-col border-b border-default @min-[34rem]:border-b-0 @min-[34rem]:border-r">
      <div class="flex h-11 flex-none items-center px-4 text-xs text-muted">
        Files <span class="ml-1.5 tabular-nums text-dimmed">{{ paths.length }}</span>
      </div>
      <FileTree
        class="min-h-48 flex-1 overflow-auto"
        :paths="paths"
        :options="treeOptions"
        :selected-path="selected"
        @update:selected-path="pick"
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
          :selected-lines="lines"
          scroll-to-selected-lines
          :options="{ overflow: 'wrap', theme: { dark: 'github-dark-default', light: 'pierre-light' } }"
        />
      </div>
    </section>
  </div>
  </div>
</template>
