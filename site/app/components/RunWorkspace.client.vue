<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue"
import type { WorkspaceView } from "#shared/report"
import type { CheckSource } from "#shared/rubric"
import { selectedLines } from "../utils/file-focus"

const FileTree = defineAsyncComponent(() => import("@vite-hub/ui").then(module => module.FileTree))
const MultiFileDiff = defineAsyncComponent(() => import("@vite-hub/ui").then(module => module.MultiFileDiff))
const FileView = defineAsyncComponent(() => import("@vite-hub/ui").then(module => module.FileView))

/** `focus` is a place to open, from a rubric check's source: the file, selected even outside "Changed", at its lines. */
const props = defineProps<{ runId: string, workspace: WorkspaceView, focus?: CheckSource }>()

const changedOnly = ref(true)
const selected = ref(props.workspace.changes.find(change => change.status !== "deleted")?.path ?? props.workspace.paths[0])
const lines = ref<{ start: number, end: number }>()
watch(() => props.focus, async (focus) => {
  if (!focus || !props.workspace.paths.includes(focus.path)) return
  if (!props.workspace.changes.some(item => item.path === focus.path && item.status !== "deleted")) changedOnly.value = false
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
const change = computed(() => props.workspace.changes.find(item => item.path === selected.value))
const paths = computed(() => changedOnly.value ? props.workspace.changes.filter(item => item.status !== "deleted").map(item => item.path) : props.workspace.paths)

const treeOptions = computed(() => ({
  density: "compact" as const,
  // The changed files are few, so show them all; the full tree starts closed.
  initialExpansion: changedOnly.value ? "open" as const : "closed" as const,
  flattenEmptyDirectories: true,
  gitStatus: props.workspace.changes.filter(item => item.status !== "deleted"),
  // As in T3 Code, names stay neutral and only the A/M letter carries the status color.
  unsafeCSS: `[data-item-git-status] > [data-item-section="content"] { color: inherit; }`,
  search: true,
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
  <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[21rem_minmax(0,1fr)] @min-[34rem]:grid-cols-[minmax(14rem,40%)_minmax(0,1fr)] @min-[34rem]:grid-rows-[minmax(0,1fr)]">
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
          class="min-h-48 flex-1 overflow-auto"
          :paths="paths"
          :options="treeOptions"
          :selected-path="selected"
          @update:selected-path="pick"
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
              :selected-lines="lines ? { ...lines, side: 'additions' } : undefined"
              scroll-to-selected-lines
              :options="{ diffStyle: 'unified', overflow: 'wrap', theme: { dark: 'github-dark-default', light: 'pierre-light' } }"
            />
            <FileView
              v-else-if="file.after !== null"
              :file="{ name: file.path, contents: file.after }"
              :selected-lines="lines"
              scroll-to-selected-lines
              :options="{ overflow: 'wrap', theme: { dark: 'github-dark-default', light: 'pierre-light' } }"
            />
          </template>
        </ClientOnly>
      </div>
    </section>
  </div>
  </div>
</template>
