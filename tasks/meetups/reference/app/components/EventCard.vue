<script setup lang="ts">
defineProps<{
  event: {
    slug: string
    title: string
    city: string
    venue: string
    startsAt: string
    priceCents: number
    seatsLeft: number
  }
}>()

const { formatPrice } = useCurrency()
</script>

<template>
  <UCard as="article" class="relative h-full">
    <div class="flex flex-col gap-2 h-full">
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
    </div>
  </UCard>
</template>
