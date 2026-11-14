<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui"
import { type EventInput, eventInputSchema } from "#shared/schemas/event"

const props = defineProps<{
  initial?: EventInput
  schema?: typeof eventInputSchema
  submitLabel: string
  save: (input: EventInput) => Promise<void>
}>()

const state = reactive<Partial<EventInput>>({
  title: "",
  description: "",
  city: "",
  venue: "",
  startsAtLocal: "",
  capacity: 50,
  priceCents: 0,
  ...props.initial,
})

onMounted(() => {
  state.timeZone ??= Intl.DateTimeFormat().resolvedOptions().timeZone
})

const priceEuros = computed({
  get: () => (state.priceCents ?? 0) / 100,
  set: (value: number | null) => { state.priceCents = Math.round((value ?? 0) * 100) },
})

const timeZones = Intl.supportedValuesOf("timeZone")
const submitted = ref(false)

let saving = false
async function onSubmit(event: FormSubmitEvent<EventInput>) {
  if (saving) return
  saving = true
  try {
    await props.save(event.data)
  }
  finally {
    saving = false
  }
}
</script>

<template>
  <UForm :schema="schema ?? eventInputSchema" :state="state" class="grid gap-4" @submit="onSubmit" :validate-on-input-delay="0" @error="submitted = true">
    <UFormField label="Title" name="title" required :eager-validation="submitted">
      <UInput v-model="state.title" class="w-full" />
    </UFormField>
    <UFormField label="Description" name="description" required :eager-validation="submitted">
      <UTextarea v-model="state.description" :rows="6" class="w-full" />
    </UFormField>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="City" name="city" required :eager-validation="submitted">
        <UInput v-model="state.city" class="w-full" />
      </UFormField>
      <UFormField label="Venue" name="venue" required :eager-validation="submitted">
        <UInput v-model="state.venue" class="w-full" />
      </UFormField>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Starts at (venue time)" name="startsAtLocal" required :eager-validation="submitted">
        <UInput v-model="state.startsAtLocal" type="datetime-local" class="w-full" />
      </UFormField>
      <UFormField label="Time zone of the venue" name="timeZone" required :eager-validation="submitted">
        <USelectMenu v-model="state.timeZone" :items="timeZones" class="w-full" />
      </UFormField>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Seats" name="capacity" required :eager-validation="submitted">
        <UInputNumber v-model="state.capacity" :min="1" :max="5000" class="w-full" />
      </UFormField>
      <UFormField label="Price in euros (0 is free)" name="priceCents" :eager-validation="submitted">
        <UInputNumber
          v-model="priceEuros"
          :min="0"
          :max="1000"
          :step="0.5"
          :format-options="{ style: 'currency', currency: 'EUR' }"
          class="w-full"
        />
      </UFormField>
    </div>
    <div>
      <UButton type="submit" :label="submitLabel" loading-auto />
    </div>
  </UForm>
</template>
