<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { projectKind, projectLabel, projectStack } from "#shared/labels"

/**
 * The results page's filters, in a sidebar as Drop's data explorer has them: one project or all of them, then the
 * models to show. Projects come in their three kinds, and the fix cases fold into one row until you open it. Each row
 * counts the runs it holds in the chosen project; a row with none is grayed.
 */
const props = defineProps<{
  projectOptions: { id: string, runs: number }[]
  /** Graded runs over every project, for the All row. */
  total: number
  agentOptions: { key: string, name: string, color: string, runs: number }[]
}>()

/** null shows every project. */
const project = defineModel<string | null>("project", { required: true })
const agentKeys = defineModel<string[]>("agents", { required: true })

const build = computed(() => props.projectOptions.filter(item => projectKind(item.id) === "build"))
const fixes = computed(() => props.projectOptions.filter(item => projectKind(item.id) === "fix"))
const scans = computed(() => props.projectOptions.filter(item => projectKind(item.id) === "scan"))
const fixRuns = computed(() => fixes.value.reduce((sum, item) => sum + item.runs, 0))
const fixesOpen = ref(projectKind(project.value ?? "") === "fix")
watch(project, (value) => {
  if (value && projectKind(value) === "fix") fixesOpen.value = true
})

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value]
}
</script>

<template>
  <div class="flex flex-col gap-7 text-sm max-lg:gap-5">
    <section>
      <h2 class="mb-1.5 font-medium text-highlighted">
        Project
      </h2>
      <ul class="filter-list">
        <li>
          <button
            type="button"
            :aria-pressed="!project"
            @click="project = null"
          >
            <span class="flex-1">All projects</span>
            <span class="count">{{ total }}</span>
          </button>
        </li>
        <li
          v-for="item in build"
          :key="item.id"
        >
          <button
            type="button"
            :aria-pressed="project === item.id"
            @click="project = item.id"
          >
            <StackLogos :project="item.id" />
            <span class="flex-1 truncate">{{ projectLabel(item.id) }}<span
              v-if="projectStack(item.id)"
              class="ml-1.5 text-xs text-dimmed"
            >{{ projectStack(item.id) }}</span></span>
            <span class="count">{{ item.runs }}</span>
          </button>
        </li>
        <li v-if="fixes.length">
          <button
            type="button"
            :aria-expanded="fixesOpen"
            @click="fixesOpen = !fixesOpen"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-3.5 shrink-0 text-dimmed transition-transform"
              :class="{ 'rotate-90': fixesOpen }"
            />
            <span class="flex-1 truncate">Fix a reported bug<span class="ml-1.5 text-xs text-dimmed">{{ fixes.length }} cases</span></span>
            <span class="count">{{ fixRuns }}</span>
          </button>
          <ul
            v-if="fixesOpen"
            class="filter-list pl-5"
          >
            <li
              v-for="item in fixes"
              :key="item.id"
            >
              <button
                type="button"
                :aria-pressed="project === item.id"
                @click="project = item.id"
              >
                <span class="flex-1 truncate">{{ projectLabel(item.id) }}</span>
                <span class="count">{{ item.runs }}</span>
              </button>
            </li>
          </ul>
        </li>
        <li
          v-for="item in scans"
          :key="item.id"
        >
          <button
            type="button"
            :aria-pressed="project === item.id"
            @click="project = item.id"
          >
            <StackLogos :project="item.id" />
            <span class="flex-1 truncate">Find hidden bugs</span>
            <span class="count">{{ item.runs }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section>
      <div class="mb-1.5 flex items-baseline justify-between">
        <h2 class="font-medium text-highlighted">
          Model
        </h2>
        <button
          v-if="agentKeys.length"
          type="button"
          class="text-xs text-muted hover:text-highlighted"
          @click="agentKeys = []"
        >
          Show all
        </button>
      </div>
      <ul class="filter-list">
        <li
          v-for="agent in agentOptions"
          :key="agent.key"
        >
          <button
            type="button"
            :aria-pressed="agentKeys.includes(agent.key)"
            :class="{ 'is-zero': !agent.runs }"
            :title="agent.runs ? undefined : 'No runs on this project yet'"
            @click="agentKeys = toggle(agentKeys, agent.key)"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :style="{ background: agent.color }"
            />
            <span class="flex-1 truncate">{{ agent.name }}</span>
            <span class="count">{{ agent.runs }}</span>
          </button>
        </li>
      </ul>
    </section>

  </div>
</template>

<style scoped>
.filter-list button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: calc(100% + 0.75rem);
  margin-inline: -0.375rem;
  padding: 0.25rem 0.375rem;
  border-radius: 0.3125rem;
  text-align: left;
  color: var(--ui-text);
  transition: background-color 120ms ease, color 120ms ease;
}

.filter-list button:hover {
  background: var(--ui-bg-elevated);
}

.filter-list button[aria-pressed="true"] {
  background: var(--ui-bg-accented);
  color: var(--ui-text-highlighted);
  font-weight: 500;
}

.filter-list button.is-zero:not([aria-pressed="true"]) {
  color: var(--ui-text-dimmed);
}

.filter-list button:focus-visible {
  outline: 2px solid var(--ui-text-highlighted);
  outline-offset: 1px;
}

.count {
  font-size: 0.75rem;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-muted);
}

/* Below the sidebar breakpoint the filters sit above the results and their rows wrap. */
@media (width < 64rem) {
  .filter-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.125rem 0.75rem;
  }

  .filter-list button {
    width: auto;
    margin-inline: 0;
  }
}
</style>
