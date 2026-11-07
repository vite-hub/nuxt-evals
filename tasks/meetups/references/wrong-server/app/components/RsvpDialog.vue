<script setup lang="ts">
import type { FormError } from "@nuxt/ui"

interface RsvpState { name: string, email: string, seats: number }

const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ booked: [seatsLeft: number] }>()

const open = ref(false)
const state = reactive<RsvpState>({ name: "", email: "", seats: 1 })

function validate(value: Partial<RsvpState>): FormError[] {
  const errors: FormError[] = []
  if (!value.name?.trim()) errors.push({ name: "name", message: "Enter your name" })
  if (!value.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email)) errors.push({ name: "email", message: "Enter a valid email address" })
  if (!value.seats || value.seats < 1 || value.seats > 4) errors.push({ name: "seats", message: "Seats must be between 1 and 4" })
  return errors
}

async function onSubmit() {
  const result = await $fetch<{ ok: boolean, seatsLeft?: number }>(`/api/events/${props.slug}/rsvp`, { method: "POST", body: state })
  if (result.ok && result.seatsLeft !== undefined) emit("booked", result.seatsLeft)
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" title="RSVP">
    <UButton label="RSVP" />
    <template #body>
      <UForm :validate="validate" :state="state" class="space-y-4" @submit="onSubmit">
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
