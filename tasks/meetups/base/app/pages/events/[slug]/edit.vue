<script setup lang="ts">
import type { EventInput } from "#shared/schemas/event"

definePageMeta({ middleware: "auth" })

const route = useRoute("events-slug-edit")
const toast = useToast()

const { data: event, error } = await useFetch(() => `/api/events/${route.params.slug}`)
if (error.value || !event.value?.isOrganizer) {
  throw createError({ status: 404, statusText: "Event not found", fatal: true })
}
useSeoMeta({ title: () => `Edit ${event.value?.title}`, robots: "noindex" })

const coverPath = ref(event.value.coverPath)

const initial: EventInput = {
  title: event.value.title,
  description: event.value.description,
  city: event.value.city,
  venue: event.value.venue,
  startsAtLocal: instantToZonedLocal(event.value.startsAt, event.value.timeZone),
  timeZone: event.value.timeZone,
  capacity: event.value.capacity,
  priceCents: event.value.priceCents,
}

async function save(input: EventInput) {
  try {
    await $fetch(`/api/events/${route.params.slug}`, { method: "PATCH", body: input })
    toast.add({ title: "Event saved", color: "success" })
    await navigateTo(`/dashboard/${route.params.slug}`)
  }
  catch (error) {
    toast.add({ title: "Couldn't save the event", description: errorMessage(error), color: "error" })
  }
}
</script>

<template>
  <div class="max-w-2xl flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      Edit event
    </h1>
    <EventCover v-model="coverPath" :slug="route.params.slug" :title="event!.title" />
    <EventForm :initial="initial" submit-label="Save changes" :save="save" />
  </div>
</template>
