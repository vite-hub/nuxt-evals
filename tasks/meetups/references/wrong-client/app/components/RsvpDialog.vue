<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui"
import { rsvpSchema, type RsvpInput } from "#shared/rsvp"

const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ booked: [seatsLeft: number] }>()

const open = ref(false)
const state = reactive<Partial<RsvpInput>>({ name: "", email: "", seats: 1 })
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<RsvpInput>) {
  const result = await $fetch(`/api/events/${props.slug}/rsvp`, { method: "POST", body: event.data })
  emit("booked", result.seatsLeft)
  open.value = false
  toast.add({ title: "You're going", description: "We sent you a confirmation email.", color: "success" })
}
</script>

<template>
  <UModal v-model:open="open" title="RSVP" description="Book your seats for this event.">
    <UButton label="RSVP" size="lg" />

    <template #body>
      <UForm :schema="rsvpSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField label="Email" name="email">
          <UInput v-model="state.email" class="w-full" />
        </UFormField>
        <UFormField label="Seats" name="seats">
          <UInputNumber v-model="state.seats" />
        </UFormField>
        <UButton type="submit" label="Confirm RSVP" />
      </UForm>
    </template>
  </UModal>
</template>
