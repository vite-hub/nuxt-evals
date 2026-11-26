<script setup lang="ts">
import markdown from "~/assets/run-it.md?raw"

useSeoMeta({
  title: "Run it yourself · Nuxt agent evals",
  description: "Clone the repository, add your keys, and run any model in Codex or Claude Code on the same projects, graded by the same judge.",
})
</script>

<template>
  <article class="py-10">
    <h1 class="text-2xl font-medium tracking-tight text-highlighted">
      Run it yourself
    </h1>
    <RunSummary
      class="mt-6"
      :markdown="markdown"
    />
  </article>
</template>
