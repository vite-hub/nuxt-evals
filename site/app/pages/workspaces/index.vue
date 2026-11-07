<script setup lang="ts">
const { data } = await useFetch<{ id: string }[]>("/api/workspaces", { key: "workspaces" })
const first = data.value?.[0]
if (first) await navigateTo(`/workspaces/${first.id}`, { replace: true })
</script>

<template>
  <p class="pt-12 text-sm text-muted">
    No workspaces yet.
  </p>
</template>
