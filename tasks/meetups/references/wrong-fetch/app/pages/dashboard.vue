<script setup lang="ts">
definePageMeta({ middleware: "organizer" })

const { data } = await useAsyncData("dashboard", () => $fetch("/api/dashboard"))
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold">
      Your next events
    </h1>
    <div v-for="event in data?.events" :key="event.slug" class="space-y-1">
      <p class="font-medium">
        {{ event.title }} · {{ event.rsvps }} RSVPs · {{ event.seatsLeft }} seats left
      </p>
      <details>
        <summary>Attendees</summary>
        <ul>
          <li v-for="attendee in event.attendees" :key="attendee.email">
            {{ attendee.name }} · {{ attendee.email }} · {{ attendee.seats }}
          </li>
        </ul>
      </details>
    </div>
    <RsvpChart v-if="data" :days="data.rsvpsPerDay" />
  </div>
</template>
