<script setup lang="ts">
const props = defineProps<{
  event: { slug: string, capacity: number, seatsLeft: number, going: boolean, isOrganizer: boolean, started: boolean }
}>()

const { user } = useAuth()
const route = useRoute()
const toast = useToast()

// The page's data is the starting point; from here this panel owns the live values.
const going = ref(props.event.going)
const seatsLeft = ref(props.event.seatsLeft)
const saving = ref(false)

async function refreshSeats() {
  try {
    seatsLeft.value = (await $fetch(`/api/events/${props.event.slug}/seats`)).seatsLeft
  }
  catch {
    // A missed poll is harmless; the next one, or a reload, catches up.
  }
}

// Other people book too. Refresh the count while the tab is visible; stop when it is hidden or left.
const visibility = useDocumentVisibility()
const { pause, resume } = useIntervalFn(refreshSeats, 5000, { immediate: false })
onMounted(() => {
  watch(visibility, state => (state === "visible" ? resume() : pause()), { immediate: true })
})

// The button turns into its opposite as soon as the server answers, which can be faster than a double click.
// Act on the first click of a burst only; keyboard activation has detail 0 and always counts.
function onClick(event: MouseEvent) {
  if (event.detail <= 1) toggle()
}

async function toggle() {
  saving.value = true
  try {
    const result = await $fetch(`/api/events/${props.event.slug}/rsvp`, { method: going.value ? "DELETE" : "POST" })
    going.value = result.going
    seatsLeft.value = result.seatsLeft
    toast.add({
      title: result.going ? "You're going" : "RSVP cancelled",
      description: result.going ? "We sent the details to your email." : undefined,
      color: result.going ? "success" : "neutral",
    })
  }
  catch (error) {
    toast.add({ title: "Couldn't save your RSVP", description: errorMessage(error), color: "error" })
    await refreshSeats()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-sm" aria-live="polite">
      <strong>{{ seatsLeft }}</strong> of {{ event.capacity }} seats left
    </p>

    <UButton v-if="event.isOrganizer" :to="`/dashboard/${event.slug}`" label="Manage event" block />
    <UButton v-else-if="event.started" label="This event has started" disabled block />
    <UButton
      v-else-if="!user"
      :to="{ path: '/sign-in', query: { redirect: route.fullPath } }"
      label="Sign in to RSVP"
      block
    />
    <UButton
      v-else-if="going"
      label="Cancel my RSVP"
      color="neutral"
      variant="outline"
      :loading="saving"
      block
      @click="onClick"
    />
    <UButton v-else :label="seatsLeft ? 'Reserve a seat' : 'Full'" :disabled="!seatsLeft" :loading="saving" block @click="onClick" />
  </div>
</template>
