<script setup lang="ts">
const props = defineProps<{ datetime: string }>()

const local = computed(() => new Date(props.datetime).toLocaleString())
const relative = computed(() => {
  const hours = Math.round((Date.parse(props.datetime) - Date.now()) / 3_600_000)
  return hours < 48 ? `in ${hours} hours` : `in ${Math.round(hours / 24)} days`
})
</script>

<template>
  <span>{{ local }} · {{ relative }}</span>
</template>
