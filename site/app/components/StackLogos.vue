<!-- The logos of what a project's prompt asks the agent to build with: Nuxt and ViteHub, or Vue alone. -->
<script setup lang="ts">
import { computed } from "vue"
import { projectKind } from "#shared/labels"

const props = defineProps<{ project: string }>()

const logos: Record<string, ("nuxt" | "vitehub" | "vue")[]> = { "meetups": ["nuxt", "vitehub"], "meal-planner": ["vue"] }
const items = computed(() => logos[props.project] ?? (projectKind(props.project) === "build" ? [] : ["nuxt", "vitehub"]))
</script>

<template>
  <span
    v-if="items.length"
    class="inline-flex shrink-0 items-center gap-1"
    aria-hidden="true"
  >
    <template
      v-for="logo in items"
      :key="logo"
    >
      <svg
        v-if="logo === 'nuxt'"
        viewBox="0 0 24 24"
        class="size-[1em]"
      ><path
        fill="#00DC82"
        d="M13.4642 19.8295h8.9218c.2834 0 .5618-.0723.8072-.2098a1.5899 1.5899 0 0 0 .5908-.5732 1.5293 1.5293 0 0 0 .216-.783 1.529 1.529 0 0 0-.2167-.7828L17.7916 7.4142a1.5904 1.5904 0 0 0-.5907-.573 1.6524 1.6524 0 0 0-.807-.2099c-.2833 0-.5616.0724-.807.2098a1.5904 1.5904 0 0 0-.5907.5731L13.4642 9.99l-2.9954-5.0366a1.5913 1.5913 0 0 0-.591-.573 1.6533 1.6533 0 0 0-.8071-.2098c-.2834 0-.5617.0723-.8072.2097a1.5913 1.5913 0 0 0-.591.573L.2168 17.4808A1.5292 1.5292 0 0 0 0 18.2635c-.0001.2749.0744.545.216.783a1.59 1.59 0 0 0 .5908.5732c.2454.1375.5238.2098.8072.2098h5.6003c2.219 0 3.8554-.9454 4.9813-2.7899l2.7337-4.5922L16.3935 9.99l4.3944 7.382h-5.8586ZM7.123 17.3694l-3.9083-.0009 5.8586-9.8421 2.9232 4.921-1.9572 3.2892c-.7478 1.1967-1.5972 1.6328-2.9163 1.6328z"
      /></svg>
      <svg
        v-else-if="logo === 'vitehub'"
        viewBox="0 0 20 18"
        class="size-[0.9em] text-highlighted"
      ><path
        fill="currentColor"
        d="M19.734 8.156 15.576.844A1.66 1.66 0 0 0 14.135 0H5.819C5.226 0 4.677.32 4.38.844L.222 8.156a1.71 1.71 0 0 0 0 1.688l4.158 7.312c.297.523.846.844 1.439.844h8.316c.593 0 1.142-.32 1.438-.844l4.158-7.312c.3-.523.3-1.165.003-1.688Z"
      /></svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        class="size-[1em]"
      ><path
        fill="#42B883"
        d="M24,1.61H14.06L12,5.16,9.94,1.61H0L12,22.39ZM12,14.08,5.16,2.23H9.59L12,6.41l2.41-4.18h4.43Z"
      /></svg>
    </template>
  </span>
</template>
