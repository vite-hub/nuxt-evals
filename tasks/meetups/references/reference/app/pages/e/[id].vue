<script setup lang="ts">
// Old links from the previous app. A 301 tells browsers and search engines the new address for good.
const route = useRoute()
const { data } = await useFetch(`/api/events/by-id/${route.params.id}`)
if (!data.value) throw createError({ status: 404, statusText: "Event not found", fatal: true })
await navigateTo(`/events/${data.value.slug}`, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
