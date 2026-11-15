<script setup lang="ts">
useHead({ title: "Your notes" })

const { $api } = useNuxtApp()
const { data: notes, error, refresh } = await useAPI("/api/notes", { default: () => [] })

const title = ref("")
const body = ref("")
const saving = ref(false)
const saveError = ref("")

async function add() {
  saving.value = true
  saveError.value = ""
  try {
    await $api("/api/notes", { method: "POST", body: { title: title.value, body: body.value } })
    title.value = ""
    body.value = ""
    await refresh()
  }
  catch {
    saveError.value = "The note wasn't saved. Try again."
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AppHeader />
    <h1>Your notes</h1>
    <p v-if="error" class="error">Your notes didn't load.</p>
    <ul v-else>
      <li v-for="note in notes" :key="note.id">
        <NuxtLink :to="`/notes/${note.id}`">{{ note.title }}</NuxtLink>
      </li>
    </ul>
    <form @submit.prevent="add">
      <label>Title <input v-model="title" name="title" required maxlength="120"></label>
      <label>Note <textarea v-model="body" name="body" rows="4" /></label>
      <button type="submit" :disabled="saving">Add note</button>
      <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
    </form>
  </div>
</template>
