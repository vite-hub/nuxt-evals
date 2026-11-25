<script setup lang="ts">
// The tempting wrong form: buttons that look like tabs, a checkbox for the switch, and a delete without a confirm.
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { data: project } = await useFetch(() => `/api/projects/${slug.value}`)
const { data: members } = await useFetch(() => `/api/projects/${slug.value}/members`, { default: () => [] })
const tab = ref("general")
const settings = reactive({ public: project.value?.visibility === "public", defaultBranch: project.value?.defaultBranch ?? "main" })

async function save() {
  await $fetch(`/api/projects/${slug.value}`, { method: "PATCH", body: { visibility: settings.public ? "public" : "private", defaultBranch: settings.defaultBranch } })
}

async function remove() {
  await $fetch(`/api/projects/${slug.value}`, { method: "DELETE" })
  await navigateTo("/")
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex gap-4">
      <button type="button" @click="tab = 'general'">
        General
      </button>
      <button type="button" @click="tab = 'members'">
        Members
      </button>
      <button type="button" @click="tab = 'danger'">
        Danger zone
      </button>
    </div>
    <div v-if="tab === 'general'" class="space-y-4">
      <label><input v-model="settings.public" type="checkbox"> Public project</label>
      <label>Default branch
        <select v-model="settings.defaultBranch">
          <option>main</option>
          <option>develop</option>
          <option>release</option>
        </select>
      </label>
      <button type="button" @click="save">
        Save changes
      </button>
    </div>
    <ul v-else-if="tab === 'members'">
      <li v-for="member in members" :key="member.id">
        {{ member.name }} {{ member.email }} {{ member.role }}
      </li>
    </ul>
    <button v-else type="button" @click="remove">
      Delete project
    </button>
  </div>
</template>
