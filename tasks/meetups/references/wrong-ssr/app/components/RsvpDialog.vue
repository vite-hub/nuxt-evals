<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui"
import { rsvpSchema, type RsvpInput } from "#shared/rsvp"

const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ booked: [seatsLeft: number] }>()

const open = ref(false)
const state = reactive<Partial<RsvpInput>>({ name: "", email: "", seats: 1 })

async function onSubmit(event: FormSubmitEvent<RsvpInput>) {
  const result = await $fetch(`/api/events/${props.slug}/rsvp`, { method: "POST", body: event.data })
  emit("booked", result.seatsLeft)
  open.value = false
}
</script>

<template>
  <UButton label="RSVP" @click="open = true" />
  <UModal v-model="open">
    <div class="p-4">
      <UForm :schema="rsvpSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name">
          <UInput v-model="state.name" />
        </UFormField>
        <UFormField label="Email" name="email">
          <UInput v-model="state.email" />
        </UFormField>
        <UFormField label="Seats" name="seats">
          <UInputNumber v-model="state.seats" />
        </UFormField>
        <UButton type="submit" label="Confirm RSVP" />
      </UForm>
    </div>
  </UModal>
</template>
