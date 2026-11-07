<script setup lang="ts">
definePageMeta({ middleware: "organizer" })

const { data } = await useFetch("/api/dashboard")

const items = computed(() => (data.value?.events ?? []).map(event => ({
  label: event.title,
  value: event.slug,
  event,
})))

useSeoMeta({ title: "Dashboard" })
</script>

<template>
  <div v-if="data" class="space-y-8">
    <h1 class="text-2xl font-semibold">
      Your next events
    </h1>

    <UAccordion :items="items" type="multiple">
      <template #default="{ item }">
        <span class="flex-1">{{ item.event.title }}</span>
        <span class="text-sm text-muted">{{ item.event.rsvps }} RSVPs · {{ item.event.seatsLeft }} seats left</span>
      </template>
      <template #content="{ item }">
        <UButton :to="`/api/events/${item.event.slug}/attendees-csv`" external download label="Download CSV" variant="link" class="mb-2 px-0" />
        <ul class="pb-3 text-sm">
          <li v-for="attendee in item.event.attendees" :key="attendee.email">
            {{ attendee.name }} · {{ attendee.email }} · {{ attendee.seats }}
          </li>
        </ul>
      </template>
    </UAccordion>

    <section class="space-y-2">
      <h2 class="font-medium">
        RSVPs per day, last 14 days
      </h2>
      <RsvpChart :days="data.rsvpsPerDay" />
    </section>
  </div>
</template>
