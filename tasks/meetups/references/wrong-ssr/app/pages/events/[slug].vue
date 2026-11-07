<script setup lang="ts">
const route = useRoute()
const currency = ref("EUR")

const { data: event } = await useFetch(`/api/events/${route.params.slug}`, { query: { currency } })
if (!event.value) throw createError({ status: 404, statusText: "Event not found", fatal: true })
const seatsLeft = ref(event.value.seatsLeft)

onMounted(() => {
  const region = navigator.language.split("-")[1]
  currency.value = region === "US" ? "USD" : region === "GB" ? "GBP" : "EUR"
  useHead({
    title: event.value?.title,
    meta: [
      { property: "og:title", content: event.value?.title },
      { property: "og:description", content: event.value?.description.slice(0, 160) },
    ],
  })
})
</script>

<template>
  <article v-if="event" class="space-y-6">
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
