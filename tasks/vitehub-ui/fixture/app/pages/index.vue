<script setup lang="ts">
useHead({ title: "Projects" })

const { data: projects } = await useFetch("/api/projects")
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">
      Projects
    </h1>
    <ul class="divide-y divide-default">
      <li v-for="project in projects" :key="project.slug" class="flex items-center justify-between py-3">
        <span class="font-medium">{{ project.name }}</span>
        <UBadge :label="project.visibility === 'public' ? 'Public' : 'Private'" color="neutral" variant="subtle" />
      </li>
    </ul>
  </div>
</template>
