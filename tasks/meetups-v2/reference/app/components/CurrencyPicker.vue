<script setup lang="ts">
const { currency } = useCurrency()
const items = [...currencies]
</script>

<template>
  <USelect v-model="currency" :items="items" aria-label="Currency" class="w-20 sm:w-24" />
</template>
