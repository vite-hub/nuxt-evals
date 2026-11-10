<script setup lang="ts">
import markdown from "~/assets/methodology.md?raw"

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
      :markdown="markdown"
    />
  </article>
</template>
