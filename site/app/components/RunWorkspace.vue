<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue"
import type { WorkspaceView } from "#shared/report"

const FileTree = defineAsyncComponent(() => import("@vite-hub/ui/file-tree").then(module => module.FileTree))
const MultiFileDiff = defineAsyncComponent(() => import("@vite-hub/ui/multi-file-diff").then(module => module.MultiFileDiff))
const FileView = defineAsyncComponent(() => import("@vite-hub/ui/file-view").then(module => module.FileView))

const props = defineProps<{ runId: string, workspace: WorkspaceView }>()

const changedOnly = ref(true)
const selected = ref(props.workspace.changes.find(change => change.status !== "deleted")?.path ?? props.workspace.paths[0])
const change = computed(() => props.workspace.changes.find(item => item.path === selected.value))
const paths = computed(() => changedOnly.value ? props.workspace.changes.filter(item => item.status !== "deleted").map(item => item.path) : props.workspace.paths)

const treeOptions = computed(() => ({
  density: "compact" as const,
  // The changed files are few, so show them all; the full tree starts closed.
  initialExpansion: changedOnly.value ? "open" as const : "closed" as const,
  flattenEmptyDirectories: true,
  initialSelectedPaths: selected.value ? [selected.value] : [],
  gitStatus: props.workspace.changes.filter(item => item.status !== "deleted"),
  search: true,
  onSelectionChange(selection: readonly string[]) {
    const path = selection.findLast(item => props.workspace.paths.includes(item))
    if (path) selected.value = path
  },
}))

const file = ref<{ path: string, before: string | null, after: string | null }>()
const loading = ref(false)
watch(selected, async (path) => {
  if (!path) return
  loading.value = true
  try {
    file.value = await $fetch(`/api/runs/${props.runId}/file`, { query: { path } })
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

const statusLabels = { added: "Added", modified: "Changed", deleted: "Deleted" }
</script>

<template>
  <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)]">
    <aside class="flex min-h-0 flex-col border-default max-md:border-b md:border-r">
      <div class="flex items-center gap-2 border-b border-default px-3 py-2 text-xs text-muted">
        <button
          type="button"
          class="seg"
          :aria-pressed="changedOnly"
          @click="changedOnly = true"
        >
          Changed <span class="tabular-nums text-dimmed">{{ workspace.changes.length }}</span>
        </button>
        <button
          type="button"
          class="seg"
          :aria-pressed="!changedOnly"
          @click="changedOnly = false"
        >
          All files <span class="tabular-nums text-dimmed">{{ workspace.paths.length }}</span>
        </button>
      </div>
      <ClientOnly>
        <FileTree
          :key="changedOnly ? 'changed' : 'all'"
          class="min-h-48 flex-1 overflow-auto"
          :paths="paths"
          :options="treeOptions"
        />
      </ClientOnly>
    </aside>
    <section class="flex min-h-0 min-w-0 flex-col">
      <header class="flex h-9 items-center gap-2 border-b border-default px-3 text-xs">
        <span class="truncate font-mono text-highlighted">{{ selected }}</span>
        <span
          v-if="change"
          class="text-muted"
        >{{ statusLabels[change.status] }} since the starting app</span>
        <span
          v-else-if="selected"
          class="text-dimmed"
        >Unchanged</span>
      </header>
      <div
        class="min-h-0 flex-1 overflow-auto"
        :class="loading ? 'opacity-60' : ''"
      >
        <ClientOnly>
          <template v-if="file && file.path === selected">
            <MultiFileDiff
              v-if="change"
              :old-file="file.before === null ? null : { name: file.path, contents: file.before }"
              :new-file="file.after === null ? null : { name: file.path, contents: file.after }"
              :options="{ diffStyle: 'unified', overflow: 'wrap' }"
            />
            <FileView
              v-else-if="file.after !== null"
              :file="{ name: file.path, contents: file.after }"
              :options="{ overflow: 'wrap' }"
            />
          </template>
        </ClientOnly>
      </div>
    </section>
  </div>
</template>
