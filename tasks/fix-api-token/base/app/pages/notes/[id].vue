<script setup lang="ts">
const route = useRoute()
const { data: note, error } = await useAPI(() => `/api/notes/${route.params.id}`)
useHead({ title: () => note.value?.title ?? "Note" })
</script>

<template>
  <div>
    <AppHeader />
    <p v-if="error" class="error">This note didn't load.</p>
    <article v-else-if="note">
      <h1>{{ note.title }}</h1>
      <p>{{ note.body }}</p>
    </article>
    <NuxtLink to="/">All notes</NuxtLink>
  </div>
</template>
