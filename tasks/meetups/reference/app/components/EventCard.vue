<script setup lang="ts">
defineProps<{
  event: {
    slug: string
    title: string
    city: string
    venue: string
    startsAt: string
    priceCents: number
    coverPath: string | null
    seatsLeft: number
  }
}>()

const { formatPrice } = useCurrency()
</script>

<template>
  <UCard as="article" class="relative h-full" :ui="{ header: 'p-0 sm:p-0 overflow-hidden', body: 'flex flex-col gap-2 h-full' }">
    <template v-if="event.coverPath" #header>
      <!-- Decorative here: the title below names the event. -->
      <img
        :src="coverUrl(event.coverPath, 640)"
        alt=""
        width="640"
        height="320"
        loading="lazy"
        class="w-full aspect-[2/1] object-cover"
      >
    </template>
    <p class="text-sm text-muted">
      <EventStart :starts-at="event.startsAt" />
    </p>
    <h2 class="font-semibold text-lg leading-snug">
      <NuxtLink :to="`/events/${event.slug}`" class="hover:underline after:absolute after:inset-0">
        {{ event.title }}
      </NuxtLink>
    </h2>
    <p class="text-sm text-muted">
      {{ event.venue }} · {{ event.city }}
    </p>
    <div class="mt-auto pt-2 flex items-center justify-between text-sm">
      <span class="font-medium">{{ formatPrice(event.priceCents) }}</span>
      <UBadge v-if="event.seatsLeft === 0" color="neutral" variant="subtle" label="Full" />
      <span v-else class="text-muted">{{ event.seatsLeft }} seats left</span>
    </div>
  </UCard>
</template>
