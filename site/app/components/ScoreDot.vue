<script setup lang="ts">
defineProps<{ status: "passed" | "failed" | "error" }>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-muted">
    <span
      class="size-1.5 shrink-0 rounded-full"
      :class="status === 'passed' ? 'bg-(--pass)' : 'bg-(--fail)'"
      aria-hidden="true"
    />
    {{ status }}
  </span>
</template>
