<script setup lang="ts">
definePageMeta({ middleware: "auth" })

const route = useRoute("dashboard-slug")
const { data, error } = await useFetch(() => `/api/events/${route.params.slug}/attendees`)
if (error.value || !data.value) {
  throw createError({ status: error.value?.status ?? 404, statusText: "Event not found", fatal: true })
}
useSeoMeta({ title: () => `Attendees · ${data.value!.event.title}`, robots: "noindex" })

const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "rsvpAt", header: "RSVP" },
]
</script>

<template>
  <div v-if="data" class="flex flex-col gap-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ data.event.title }}
        </h1>
        <p class="text-muted">
          {{ data.attendees.length }} of {{ data.event.capacity }} seats taken
        </p>
      </div>
      <div class="flex gap-2">
        <UButton :to="`/events/${data.event.slug}`" label="View page" color="neutral" variant="outline" />
        <UButton :to="`/events/${data.event.slug}/edit`" label="Edit" color="neutral" variant="outline" />
        <UButton
          :to="`/api/events/${data.event.slug}/attendees.csv`"
          external
          download
          icon="i-lucide-download"
          label="Export CSV"
        />
      </div>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          RSVPs per day
        </h2>
      </template>
      <RsvpChart :dates="data.attendees.map(a => a.rsvpAt)" />
    </UCard>

    <UTable :data="data.attendees" :columns="columns" :empty="'Nobody has RSVPed yet.'">
      <template #rsvpAt-cell="{ row }">
        <NuxtTime :datetime="row.original.rsvpAt" date-style="medium" time-style="short" />
      </template>
    </UTable>
  </div>
</template>
