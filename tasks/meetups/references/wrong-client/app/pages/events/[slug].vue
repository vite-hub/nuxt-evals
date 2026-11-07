<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const currency = useCurrency()

const { data: event, error } = await useFetch(() => `/api/events/${slug.value}`, { query: { currency } })
if (error.value?.status === 404 || !event.value) {
  throw createError({ status: 404, statusText: "Event not found", fatal: true })
}

const seatsLeft = ref(event.value.seatsLeft)

// Wrong: a timer that is never cleared and ignores hidden tabs.
onMounted(() => {
  setInterval(async () => {
    seatsLeft.value = (await $fetch(`/api/events/${slug.value}/seats`)).seatsLeft
  }, 3000)
})

useSeoMeta({
  title: () => event.value?.title,
  description: () => event.value?.description.slice(0, 160),
  ogTitle: () => event.value?.title,
  ogDescription: () => event.value?.description.slice(0, 160),
})
</script>

<template>
  <article v-if="event" class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold">
        {{ event.title }}
      </h1>
      <p class="text-muted">
        <EventStart :datetime="event.startsAt" /> · {{ event.city }} · {{ event.venue.name }}, {{ event.venue.address }}
      </p>
    </header>

    <div class="flex flex-wrap items-center gap-4">
      <span class="text-lg font-medium">{{ event.price }}</span>
      <span>{{ seatsLeft }} seats left</span>
      <RsvpDialog :slug="event.slug" @booked="seatsLeft = $event" />
    </div>

    <p class="whitespace-pre-line">
      {{ event.description }}
    </p>
  </article>
</template>
