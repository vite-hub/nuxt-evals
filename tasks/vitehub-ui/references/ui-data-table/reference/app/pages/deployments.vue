<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui"
import type { Column } from "@tanstack/vue-table"

interface Deployment {
  id: string
  project: string
  branch: string
  status: string
  author: string
  createdAt: string
  durationSeconds: number
}

useHead({ title: "Deployments" })

const { data: deployments } = await useFetch<Deployment[]>("/api/deployments", { default: () => [] })
const filter = ref("")
const sorting = ref([{ id: "createdAt", desc: true }])

const shown = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  if (!needle) return deployments.value
  return deployments.value.filter(item => item.branch.toLowerCase().includes(needle) || item.author.toLowerCase().includes(needle))
})

const UButton = resolveComponent("UButton")
const UBadge = resolveComponent("UBadge")
const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })
const statusColor = { ready: "success", error: "error", building: "info", canceled: "neutral" } as const

function sortHeader(label: string) {
  return ({ column }: { column: Column<Deployment> }) => {
    const sorted = column.getIsSorted()
    return h(UButton, {
      color: "neutral",
      variant: "ghost",
      label,
      class: "-mx-2.5",
      icon: sorted === "asc" ? "i-lucide-arrow-up-narrow-wide" : sorted === "desc" ? "i-lucide-arrow-down-wide-narrow" : "i-lucide-arrow-up-down",
      onClick: () => column.toggleSorting(sorted === "asc"),
    })
  }
}

const columns: TableColumn<Deployment>[] = [
  { accessorKey: "id", header: "Deployment", enableSorting: false },
  { accessorKey: "project", header: "Project", enableSorting: false },
  { accessorKey: "branch", header: "Branch", enableSorting: false },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => h(UBadge, { label: row.original.status, color: statusColor[row.original.status as keyof typeof statusColor], variant: "subtle", class: "capitalize" }),
  },
  { accessorKey: "author", header: "Author", enableSorting: false },
  { accessorKey: "createdAt", enableSorting: true, header: sortHeader("Created"), cell: ({ row }) => date.format(new Date(row.original.createdAt)) },
  { accessorKey: "durationSeconds", enableSorting: true, header: sortHeader("Duration"), cell: ({ row }) => `${Math.floor(row.original.durationSeconds / 60)}m ${row.original.durationSeconds % 60}s` },
]
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">
      Deployments
    </h1>
    <UInput v-model="filter" type="search" icon="i-lucide-search" placeholder="Branch or author" aria-label="Filter deployments" class="max-w-sm" />
    <UTable v-model:sorting="sorting" :data="shown" :columns="columns">
      <template #empty>
        <div class="flex flex-col items-center gap-3 py-6">
          <p>No deployments match "{{ filter }}".</p>
          <UButton label="Clear filter" color="neutral" variant="outline" @click="filter = ''" />
        </div>
      </template>
    </UTable>
  </div>
</template>
