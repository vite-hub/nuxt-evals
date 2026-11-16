<script setup lang="ts">
useHead({ title: "Projects" })

const { data: projects } = await useFetch("/api/projects")
</script>

<template>
  <div class="stack">
    <h1 class="title">
      Projects
    </h1>
    <ul class="rows">
      <li v-for="project in projects" :key="project.slug" class="row">
        <span class="name">{{ project.name }}</span>
        <span class="badge">{{ project.visibility === 'public' ? 'Public' : 'Private' }}</span>
      </li>
    </ul>
  </div>
</template>
