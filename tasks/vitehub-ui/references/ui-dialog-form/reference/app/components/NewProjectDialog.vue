<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui"
import { z } from "zod"

const emit = defineEmits<{ created: [] }>()

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer"),
  visibility: z.enum(["private", "public"]),
})
type Schema = z.output<typeof schema>

const open = ref(false)
const state = reactive<Schema>({ name: "", visibility: "private" })
const form = useTemplateRef("form")
const visibilities = [{ label: "Private", value: "private" }, { label: "Public", value: "public" }]

watch(open, (value) => {
  if (value) Object.assign(state, { name: "", visibility: "private" })
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  try {
    await $fetch("/api/projects", { method: "POST", body: event.data })
    open.value = false
    emit("created")
  }
  catch (error) {
    const message = (error as { data?: { message?: string } }).data?.message ?? "The project could not be created"
    form.value?.setErrors([{ name: "name", message }])
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New project" description="Projects hold your deployments and settings.">
    <UButton label="New project" icon="i-lucide-plus" />
    <template #body>
      <UForm ref="form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name" required>
          <UInput v-model="state.name" class="w-full" autocomplete="off" />
        </UFormField>
        <UFormField label="Visibility" name="visibility">
          <URadioGroup v-model="state.visibility" :items="visibilities" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" label="Create project" loading-auto />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
