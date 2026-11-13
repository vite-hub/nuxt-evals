<script setup lang="ts">
useHead({ title: "Assistant" })
</script>

<template>
  <div class="flex h-[calc(100dvh-10rem)] flex-col gap-4">
    <h1 class="text-2xl font-semibold">
      Assistant
    </h1>
    <AssistantChat class="min-h-0 flex-1" />
  </div>
</template>
