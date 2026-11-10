<script setup lang="ts">
import type { NuxtError } from "#app"

const props = defineProps<{ error: NuxtError }>()

const notFound = computed(() => props.error.status === 404)
useSeoMeta({ title: () => (notFound.value ? "Page not found" : "Something went wrong"), robots: "noindex" })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <div class="py-16 flex flex-col items-center gap-4 text-center">
        <p class="text-6xl font-semibold text-primary">
          {{ error.status }}
        </p>
        <h1 class="text-2xl font-semibold">
          {{ notFound ? "We couldn't find that page" : "Something went wrong" }}
        </h1>
        <p class="text-muted">
          {{ notFound ? "The event may have been removed, or the link is wrong." : "Try again in a moment." }}
        </p>
        <UButton label="Browse events" @click="clearError({ redirect: '/' })" />
      </div>
    </NuxtLayout>
  </UApp>
</template>
