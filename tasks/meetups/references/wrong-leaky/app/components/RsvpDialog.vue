<script setup lang="ts">
const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ booked: [seatsLeft: number] }>()

const open = ref(false)
const state = reactive({ name: "", email: "", seats: 1 })
const error = ref("")

async function onSubmit() {
  error.value = ""
  try {
    const result = await $fetch(`/api/events/${props.slug}/rsvp`, { method: "POST", body: state })
    emit("booked", result.seatsLeft)
    open.value = false
  }
  catch {
    error.value = "Check your details and try again."
  }
}
</script>

<template>
  <UModal v-model:open="open" title="RSVP">
    <UButton label="RSVP" />
    <template #body>
      <UForm :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField label="Email" name="email">
          <UInput v-model="state.email" class="w-full" />
        </UFormField>
        <UFormField label="Seats" name="seats">
          <UInputNumber v-model="state.seats" />
        </UFormField>
        <p v-if="error" class="text-error text-sm">
          {{ error }}
        </p>
        <UButton type="submit" label="Confirm RSVP" />
      </UForm>
    </template>
  </UModal>
</template>
