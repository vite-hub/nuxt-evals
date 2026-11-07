<script setup lang="ts">
defineProps<{ datetime: string }>()
</script>

<template>
  <span>
    <NuxtTime :datetime="datetime" weekday="short" day="numeric" month="short" hour="2-digit" minute="2-digit" />
    ·
    <NuxtTime :datetime="datetime" relative />
  </span>
</template>
