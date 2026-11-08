<script setup lang="ts">
import type { EventInput } from "#shared/schemas/event"

definePageMeta({ middleware: "auth" })
useSeoMeta({ title: "New event" })

const toast = useToast()

async function create(input: EventInput) {
  try {
    const { slug } = await $fetch("/api/events", { method: "POST", body: input })
    await navigateTo(`/events/${slug}`)
  }
  catch (error) {
    toast.add({ title: "Couldn't create the event", description: errorMessage(error), color: "error" })
  }
}
</script>

<template>
  <div class="max-w-2xl flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">
      New event
    </h1>
    <EventForm submit-label="Create event" @submit="create" />
  </div>
</template>
