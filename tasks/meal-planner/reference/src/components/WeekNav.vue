<script setup lang="ts">
import type { useWeek } from "../composables/week"
import { useI18n } from "../i18n"

// A week page's heading: its title with the week under it, and links to the weeks around it.
defineProps<{ title: string, route: "plan" | "shopping", week: ReturnType<typeof useWeek> }>()
const { t } = useI18n()
</script>

<template>
  <div class="heading">
    <h1 tabindex="-1">
      {{ title }} <span class="week">{{ week.label.value }}</span>
    </h1>
    <nav class="toolbar no-print" :aria-label="t.plan.weeks">
      <RouterLink class="button" :to="{ name: route, params: { week: week.previous.value } }">
        <span aria-hidden="true">←</span> {{ t.plan.previous }}
      </RouterLink>
      <RouterLink v-if="!week.isCurrent.value" class="button" :to="{ name: route, params: { week: week.current.value } }">
        {{ t.plan.thisWeek }}
      </RouterLink>
      <RouterLink class="button" :to="{ name: route, params: { week: week.next.value } }">
        {{ t.plan.next }} <span aria-hidden="true">→</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  margin-bottom: 0.75rem;
}

.heading h1 {
  margin: 0;
}

.week {
  display: block;
  color: var(--muted);
  font-size: 1rem;
  font-weight: 500;
}
</style>
