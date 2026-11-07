<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/events/by-id/${route.params.id}`)
if (!data.value) throw createError({ status: 404, statusText: "Event not found", fatal: true })
// Wrong: navigateTo answers 302 on the server unless it gets a redirect code.
await navigateTo(`/events/${data.value.slug}`)
</script>

<template>
  <div />
</template>
