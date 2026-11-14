<script setup lang="ts">
definePageMeta({ middleware: "auth" })
useSeoMeta({ title: "Your events", robots: "noindex" })

const { data: events, error } = await useFetch("/api/dashboard", { default: () => [] })
if (error.value) throw createError({ status: error.value.status ?? 500, statusText: "Couldn't load your events", fatal: true })
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold">
        Your events
      </h1>
      <UButton to="/events/new" icon="i-lucide-plus" label="New event" />
    </div>

    <UEmpty
      v-if="!events.length"
      icon="i-lucide-calendar-plus"
      title="You don't organize any events yet"
      :actions="[{ label: 'Create your first event', to: '/events/new' }]"
    />

    <ul v-else class="divide-y divide-default border border-default rounded-(--ui-radius)">
      <li v-for="event in events" :key="event.slug" class="p-4 flex items-center justify-between gap-4">
        <div>
          <NuxtLink :to="`/dashboard/${event.slug}`" class="font-medium hover:underline">
            {{ event.title }}
          </NuxtLink>
          <p class="text-sm text-muted">
            <NuxtTime :datetime="event.startsAt" date-style="medium" time-style="short" /> · {{ event.city }}
          </p>
        </div>
        <UBadge
          :label="`${event.taken} / ${event.capacity} going`"
          :color="event.taken >= event.capacity ? 'success' : 'neutral'"
          variant="subtle"
        />
      </li>
    </ul>
  </div>
</template>
