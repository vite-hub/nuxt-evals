<script setup lang="ts">
import { COVER_MAX_BYTES, COVER_MAX_MB, COVER_TYPES } from "#shared/utils/cover"

/** The organizer's cover photo control: shows the current photo, uploads a new one, removes it. */
const props = defineProps<{ slug: string, title: string }>()
const coverPath = defineModel<string | null>({ required: true })

const toast = useToast()
const problem = ref("")
const busy = ref(false)

// Checked here first, so a 20 MB phone photo is refused at once instead of after the upload. The server repeats it.
function check(file: File): string {
  if (!(COVER_TYPES as readonly string[]).includes(file.type)) return "Choose a JPEG, PNG or WebP photo."
  if (file.size > COVER_MAX_BYTES) return `Choose a photo of ${COVER_MAX_MB} MB or less.`
  return ""
}

async function send(run: () => Promise<{ coverPath: string | null }>, done: string) {
  busy.value = true
  try {
    coverPath.value = (await run()).coverPath
    toast.add({ title: done, color: "success" })
  }
  catch (error) {
    problem.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

// UFileUpload hands over a File, or null when its value is cleared.
async function upload(file: unknown) {
  if (!(file instanceof File)) return
  problem.value = check(file)
  if (problem.value) return
  const body = new FormData()
  body.append("cover", file)
  await send(() => $fetch(`/api/events/${props.slug}/cover`, { method: "PUT", body }), "Cover photo saved")
}

const remove = () => send(() => $fetch(`/api/events/${props.slug}/cover`, { method: "DELETE" }), "Cover photo removed")
</script>

<template>
  <UFormField label="Cover photo" name="cover" :error="problem || undefined">
    <div class="flex flex-col gap-3 max-w-md">
      <img
        v-if="coverPath"
        :src="coverUrl(coverPath, 640)"
        :alt="`Cover photo of ${title}`"
        width="640"
        height="320"
        class="w-full aspect-[2/1] object-cover rounded-(--ui-radius) border border-default"
      >
      <!-- Uploaded on choice, so the field keeps no file of its own. -->
      <UFileUpload
        :model-value="null"
        :accept="COVER_TYPES.join(',')"
        :label="coverPath ? 'Drop a new photo here to replace it' : 'Drop a photo here'"
        :description="`or click to choose one. JPEG, PNG or WebP, up to ${COVER_MAX_MB} MB.`"
        :preview="false"
        :disabled="busy"
        class="w-full min-h-32"
        @update:model-value="upload"
        @reject="problem = 'Choose a JPEG, PNG or WebP photo.'"
      />
      <UButton v-if="coverPath" label="Remove photo" color="neutral" variant="outline" class="self-start" :disabled="busy" @click="remove" />
    </div>
  </UFormField>
</template>
