<script setup lang="ts">
const route = useRoute()
const { data: event } = await useFetch(`/api/events/${route.params.slug}`)
const seatsLeft = ref(event.value?.seatsLeft ?? 0)

useSeoMeta({
  title: () => event.value?.title ?? "Event not found",
  description: () => event.value?.description.slice(0, 160),
  ogTitle: () => event.value?.title,
  ogDescription: () => event.value?.description.slice(0, 160),
})
</script>

<template>
  <div v-if="!event" class="space-y-2">
    <h1 class="text-2xl font-semibold">
      Event not found
    </h1>
    <NuxtLink to="/events">
      Back to events
    </NuxtLink>
  </div>
  <article v-else class="space-y-6">
    <h1 class="text-3xl font-semibold">
      {{ event.title }}
    </h1>
    <p class="text-muted">
      <EventStart :datetime="event.startsAt" /> · {{ event.city }} · {{ event.venue.name }}
    </p>
    <div class="flex items-center gap-4">
      <span>{{ event.price }}</span>
      <span>{{ seatsLeft }} seats left</span>
      <RsvpDialog :slug="event.slug" @booked="seatsLeft = $event" />
    </div>
    <p class="whitespace-pre-line">
      {{ event.description }}
    </p>
  </article>
</template>
