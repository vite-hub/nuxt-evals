<script setup lang="ts">
import markdown from "~/assets/methodology.md?raw"

// The project list is live data, so it goes between the text before the Projects section's marker and the text after.
const [beforeProjects, afterProjects] = markdown.split("<!-- projects -->") as [string, string?]

useSeoMeta({
  title: "Methodology · Nuxt agent evals",
  description: "How the runs work, how the judge grades them, and what the numbers can't tell you yet.",
})
</script>

<template>
  <article class="py-10">
    <h1 class="text-2xl font-medium tracking-tight text-highlighted">
      Methodology
    </h1>
    <RunSummary
      class="mt-6"
      :markdown="beforeProjects"
    />
    <template v-if="afterProjects">
      <ProjectList class="mt-5" />
      <RunSummary
        class="mt-8"
        :markdown="afterProjects"
      />
    </template>
  </article>
</template>
