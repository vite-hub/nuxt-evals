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
  // As in T3 Code, names stay neutral and only the A/M letter carries the status color.
  unsafeCSS: `[data-item-git-status] > [data-item-section="content"] { color: inherit; }`,
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

</script>

<template>
  <div class="@container flex min-h-0 flex-1 flex-col">
  <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[18rem_minmax(0,1fr)] @min-[34rem]:grid-cols-[minmax(14rem,40%)_minmax(0,1fr)] @min-[34rem]:grid-rows-[minmax(0,1fr)]">
    <aside class="flex min-h-0 flex-col border-b border-default @min-[34rem]:border-b-0 @min-[34rem]:border-r">
      <div class="flex h-11 flex-none items-center px-3 text-xs text-muted">
        <div class="seg-track">
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
              :options="{ diffStyle: 'unified', overflow: 'wrap', theme: { dark: 'github-dark-default', light: 'pierre-light' } }"
            />
            <FileView
              v-else-if="file.after !== null"
              :file="{ name: file.path, contents: file.after }"
              :options="{ overflow: 'wrap', theme: { dark: 'github-dark-default', light: 'pierre-light' } }"
            />
          </template>
        </ClientOnly>
      </div>
    </section>
  </div>
  </div>
</template>
