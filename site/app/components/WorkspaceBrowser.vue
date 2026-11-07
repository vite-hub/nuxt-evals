<script setup lang="ts">
import { computed } from "vue"
import { FileTree } from "@vite-hub/ui/file-tree"
import { FileView } from "@vite-hub/ui/file-view"

/**
 * Three panes, like the Console's Agent session: the workspaces, the file tree of the open one, and one open file.
 * It only composes @vite-hub/ui parts, so it can move into @vite-hub/ui as a reusable component.
 */
export interface WorkspaceItem {
  id: string
  label: string
  detail?: string
  group?: string
  to: string
}

const props = defineProps<{
  workspaces: WorkspaceItem[]
  active?: string
  files: { path: string, content: string }[]
  file?: string
  changed?: string[]
}>()
const emit = defineEmits<{ selectFile: [path: string] }>()

const groups = computed(() => {
  const map = new Map<string, WorkspaceItem[]>()
  for (const item of props.workspaces) map.set(item.group ?? "", [...(map.get(item.group ?? "") ?? []), item])
  return [...map.entries()]
})
const paths = computed(() => props.files.map(file => file.path))
const open = computed(() => props.files.find(file => file.path === props.file) ?? props.files[0])
const treeOptions = computed(() => ({
  initialExpansion: "open" as const,
  initialSelectedPaths: open.value ? [open.value.path] : [],
  gitStatus: (props.changed ?? []).map(path => ({ path, status: "modified" as const })),
  onSelectionChange: (selected: readonly string[]) => {
    const path = selected[0]
    if (path && props.files.some(file => file.path === path)) emit("selectFile", path)
  },
}))
</script>

<template>
  <div class="grid min-h-[36rem] grid-cols-1 overflow-hidden rounded-[calc(var(--ui-radius)*3)] border border-default md:grid-cols-[14rem_15rem_1fr]">
    <nav
      aria-label="Workspaces"
      class="border-b border-default bg-elevated p-2 text-sm md:border-b-0 md:border-r"
    >
      <div
        v-for="[group, items] in groups"
        :key="group"
        class="mb-3"
      >
        <p
          v-if="group"
          class="px-2 py-1 text-xs text-dimmed"
        >
          {{ group }}
        </p>
        <NuxtLink
          v-for="item in items"
          :key="item.id"
          :to="item.to"
          class="block rounded-(--ui-radius) px-2 py-1.5 transition-colors"
          :class="item.id === active ? 'bg-muted text-highlighted' : 'text-muted hover:bg-muted hover:text-highlighted'"
          :aria-current="item.id === active ? 'page' : undefined"
        >
          <span class="block truncate">{{ item.label }}</span>
          <span
            v-if="item.detail"
            class="block truncate text-xs tabular-nums text-dimmed"
          >{{ item.detail }}</span>
        </NuxtLink>
      </div>
    </nav>

    <div class="min-w-0 border-b border-default p-2 md:border-b-0 md:border-r">
      <ClientOnly>
        <FileTree
          v-if="paths.length"
          :key="active"
          :paths="paths"
          :options="treeOptions"
          search-label="Search files"
        />
      </ClientOnly>
    </div>

    <div class="min-w-0 overflow-auto">
      <ClientOnly>
        <FileView
          v-if="open"
          :key="`${active}:${open.path}`"
          :file="{ name: open.path, contents: open.content }"
        />
        <template #fallback>
          <pre class="code m-3 px-4 py-3"><code>{{ open?.content }}</code></pre>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
