<script setup lang="ts">
// NuxtTime renders on the server, then formats again in the browser before hydration,
// so the visitor sees their own time zone and the page still hydrates without a mismatch.
defineProps<{ startsAt: string | Date }>()
</script>

<template>
  <NuxtTime :datetime="startsAt" weekday="short" day="numeric" month="short" hour="2-digit" minute="2-digit" />
  · <NuxtTime :datetime="startsAt" relative />
</template>
