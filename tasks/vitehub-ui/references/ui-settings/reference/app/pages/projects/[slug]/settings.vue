<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui"

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const toast = useToast()

const { data: project, error } = await useFetch(() => `/api/projects/${slug.value}`)
if (error.value) throw createError({ status: 404, message: "Project not found", fatal: true })
const { data: members } = await useFetch(() => `/api/projects/${slug.value}/members`, { default: () => [] })

useHead({ title: () => `${project.value?.name ?? "Project"} settings` })

const tabs: TabsItem[] = [
  { label: "General", slot: "general" as const },
  { label: "Members", slot: "members" as const },
  { label: "Danger zone", slot: "danger" as const },
]
const branches = ["main", "develop", "release"]
const settings = reactive({ public: project.value?.visibility === "public", defaultBranch: project.value?.defaultBranch ?? "main" })

async function save() {
  try {
    await $fetch(`/api/projects/${slug.value}`, { method: "PATCH", body: { visibility: settings.public ? "public" : "private", defaultBranch: settings.defaultBranch } })
    toast.add({ title: "Settings saved", color: "success" })
  }
  catch {
    toast.add({ title: "The settings could not be saved", color: "error" })
  }
}

const confirming = ref(false)
async function remove() {
  await $fetch(`/api/projects/${slug.value}`, { method: "DELETE" })
  confirming.value = false
  await navigateTo("/")
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">
      {{ project?.name }} settings
    </h1>
    <UTabs :items="tabs" variant="link" :unmount-on-hide="false">
      <template #general>
        <form class="max-w-md space-y-6 py-4" @submit.prevent="save">
          <USwitch v-model="settings.public" label="Public project" description="Anyone with the link can see deployments." />
          <UFormField label="Default branch" name="defaultBranch">
            <USelect v-model="settings.defaultBranch" :items="branches" class="w-48" />
          </UFormField>
          <UButton type="submit" label="Save changes" loading-auto />
        </form>
      </template>
      <template #members>
        <ul class="divide-y divide-default py-4">
          <li v-for="member in members" :key="member.id" class="flex items-center justify-between py-3">
            <div>
              <p class="font-medium">
                {{ member.name }}
              </p>
              <p class="text-sm text-muted">
                {{ member.email }}
              </p>
            </div>
            <UBadge :label="member.role" color="neutral" variant="subtle" class="capitalize" />
          </li>
        </ul>
      </template>
      <template #danger>
        <div class="space-y-3 py-4">
          <p>Deleting a project removes its deployments and settings. This can't be undone.</p>
          <UModal v-model:open="confirming" :title="`Delete ${project?.name}?`" description="The project, its deployments and its settings are deleted. This can't be undone.">
            <UButton label="Delete project" color="error" variant="soft" />
            <template #footer>
              <div class="flex w-full justify-end gap-2">
                <UButton label="Cancel" color="neutral" variant="ghost" @click="confirming = false" />
                <UButton label="Delete project" color="error" @click="remove" />
              </div>
            </template>
          </UModal>
        </div>
      </template>
    </UTabs>
  </div>
</template>
