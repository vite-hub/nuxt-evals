<script setup lang="ts">
defineProps<{ startsAt: string | Date }>()
</script>

<template>
  <NuxtTime :datetime="startsAt" weekday="short" day="numeric" month="short" hour="2-digit" minute="2-digit" />
  · <NuxtTime :datetime="startsAt" relative />
</template>
