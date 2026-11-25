<script setup lang="ts">
useHead({ title: "Projects" })

const { data: projects, refresh } = await useFetch("/api/projects")
</script>

<template>
  <div class="stack">
    <div class="heading">
      <h1 class="title">
        Projects
      </h1>
      <NewProjectDialog @created="refresh()" />
    </div>
    <ul class="rows">
      <li v-for="project in projects" :key="project.slug" class="row">
        <span class="name">{{ project.name }}</span>
        <span class="badge">{{ project.visibility === 'public' ? 'Public' : 'Private' }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
