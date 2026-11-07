<script setup lang="ts">
import type { NuxtError } from "#app"

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.status === 404)
useSeoMeta({ title: () => notFound.value ? "Not found" : "Something went wrong" })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <div class="space-y-4">
        <h1 class="text-2xl font-semibold">
          {{ notFound ? "We couldn't find that page" : "Something went wrong" }}
        </h1>
        <p class="text-muted">
          {{ notFound ? "The event may have been removed, or the link is wrong." : error.statusText }}
        </p>
        <UButton label="Back to events" to="/events" @click.prevent="clearError({ redirect: '/events' })" />
      </div>
    </NuxtLayout>
  </UApp>
</template>
