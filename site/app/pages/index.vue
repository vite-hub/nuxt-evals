<script setup lang="ts">
import { computed, ref } from "vue"
import type { ProjectView, RunSummary } from "#shared/report"
import { projectLabel } from "#shared/labels"
import type { ScatterGroup, ScatterPoint } from "../components/EvalScatter.vue"
import { agentsOf, runCost, runTokens } from "../utils/agents"
import { duration, money, tokens } from "../utils/format"
import { fiveScale, median } from "../utils/rubric"

definePageMeta({ bleed: true })

const { data: runs } = await useFetch<RunSummary[]>("/api/runs", { key: "runs", default: () => [] })

const route = useRoute()
const router = useRouter()

/** Every graded run counts toward one set of scores; each task is a project with a rubric. */
const graded = computed(() => runs.value.filter(run => run.rubric))
const tasks = computed(() => [...new Set(graded.value.map(run => run.project))].sort())
const agents = computed(() => agentsOf(graded.value))

// This page shows the reference app's outcomes only. Its evidence and cited lines stay on the run and project pages,
// which is why the key differs from theirs.
const task = computed(() => tasks.value[0])
const { data: projectView } = useFetch<ProjectView>(() => `/api/projects/${task.value}`, {
  key: () => `project-outcomes-${task.value}`,
  lazy: true,
  immediate: Boolean(task.value),
  transform: view => view.reference ? { ...view, reference: { ...view.reference, setupNotes: undefined, checks: view.reference.checks.map(check => ({ id: check.id, outcome: check.outcome, evidence: "" })) } } : view,
})
const checkCount = computed(() => projectView.value?.rubric?.checks.length)

const views = [
  { id: "cost", label: "Score vs cost", axis: "Cost per run (USD, log scale)" },
  { id: "time", label: "Score vs time", axis: "Time per run (log scale)" },
  { id: "tokens", label: "Score vs tokens", axis: "Tokens per run (log scale)" },
] as const
type View = (typeof views)[number]["id"]
const tabs = [{ id: "sections" as const, label: "Sections" }, ...views]
const tab = computed(() => tabs.find(item => item.id === route.query.view)?.id ?? "sections")
const view = computed(() => views.find(item => item.id === tab.value))

function setTab(id: string) {
  void router.replace({ query: { ...route.query, view: id === "sections" ? undefined : id } })
}

/** The section whose failed checks the list shows; a section name in the grid sets it. */
const section = ref<string | null>(null)

function xOf(run: RunSummary, axis: View): number {
  if (axis === "time") return run.durationMs / 60_000
  if (axis === "tokens") return runTokens(run)
  return runCost(run)
}

const points = computed<ScatterPoint[]>(() => view.value
  ? agents.value.flatMap(agent => agent.runs.map(run => ({ id: run.id, group: `${agent.name} run ${run.n}`, x: xOf(run, view.value!.id), y: run.rubric.score / 5, tone: run.harness, color: agent.color })))
      .filter(point => Number.isFinite(point.x) && point.x > 0)
  : [])

const medians = computed<ScatterGroup[]>(() => view.value
  ? agents.value.flatMap((agent) => {
      const x = median(agent.runs.map(run => xOf(run, view.value!.id)).filter(value => Number.isFinite(value) && value > 0))
      return x === null ? [] : [{ key: agent.key, label: `${agent.name}  ${fiveScale(agent.score)}`, x, y: agent.score / 5, tone: agent.runs[0]!.harness, color: agent.color }]
    })
  : [])

/** Agents a chart leaves out because their runs have no value on its axis, such as a model with no list price yet. */
const missing = computed(() => view.value ? agents.value.filter(agent => !medians.value.some(group => group.key === agent.key)) : [])

const formatters: Record<View, (value: number) => string> = {
  cost: value => money(value),
  time: value => value < 60 ? `${Math.round(value)} min` : `${(value / 60).toFixed(1).replace(/\.0$/, "")} h`,
  tokens: value => tokens(value),
}

function openRun(id: string) {
  void navigateTo(`/runs/${id}`)
}

useSeoMeta({ title: "Nuxt + ViteHub agent evals" })
</script>

<template>
  <div class="flex min-h-[calc(100svh-3.25rem)] min-w-0 flex-col">
    <div class="border-b border-default px-5 pb-6 pt-6">
      <h1 class="text-lg font-medium text-highlighted">
        Nuxt + ViteHub agent evals
      </h1>
      <p class="mt-1.5 max-w-prose text-sm leading-6 text-pretty text-muted">
        Can coding agents build a real app with Nuxt 5 and ViteHub? Each task gives an agent a short prompt and an empty folder. An Opus 5.5 judge grades the finished app on a rubric, and grades a reference app the same way.
      </p>
      <p
        v-if="tasks.length"
        class="mt-2 text-[13px] text-muted"
      >
        Tasks:
        <template
          v-for="(item, index) in tasks"
          :key="item"
        >
          <NuxtLink
            :to="`/projects/${item}`"
            class="text-default underline decoration-dimmed underline-offset-2 transition-colors hover:text-highlighted"
          >{{ projectLabel(item) }}</NuxtLink><span
            v-if="index === 0 && checkCount"
            class="text-dimmed"
          > ({{ checkCount }} checks)</span>{{ index < tasks.length - 1 ? ", " : "." }}
        </template>
        More tasks will join the same scores.
      </p>
    </div>

    <div class="flex h-12 items-center gap-6 overflow-x-auto border-b border-default px-5 text-sm">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        class="tab"
        :aria-pressed="tab === item.id"
        @click="setTab(item.id)"
      >
        {{ item.label }}
      </button>
    </div>

    <p
      v-if="!agents.length"
      class="px-5 py-16 text-center text-sm text-muted"
    >
      No graded runs yet. Start one with <code class="font-mono text-highlighted">pnpm evals run meetups-v2</code>.
    </p>

    <template v-else>
      <RubricResults
        v-if="tab === 'sections'"
        v-model:section="section"
        part="sections"
        :agents="agents"
        :project="projectView"
      />

      <section
        v-else
        class="flex flex-col px-5 pb-6 pt-4"
      >
        <EvalScatter
          class="mt-4 h-[30rem]"
          :points="points"
          :groups="medians"
          :x-label="view!.axis"
          :log="true"
          :format="formatters[view!.id]"
          :y-format="(value: number) => fiveScale(value * 5)"
          :y-ticks="[0.2, 0.4, 0.6, 0.8, 1]"
          @open="openRun"
        />
        <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] sm:hidden">
          <li
            v-for="agent in agents"
            :key="agent.key"
            class="flex items-center gap-2"
          >
            <span
              class="size-2 rounded-full"
              :style="{ background: agent.color }"
            />
            {{ agent.name }}
            <span class="text-muted">{{ fiveScale(agent.score) }}</span>
          </li>
        </ul>
        <p class="mt-3 text-xs text-dimmed">
          Each dot is a run; click one to open its session. The bigger dot is each agent's median.
          <template v-if="missing.length">
            Not shown: {{ missing.map(agent => agent.name).join(", ") }} (no list price yet).
          </template>
        </p>
      </section>

      <RubricResults
        v-model:section="section"
        part="checks"
        :agents="agents"
        :project="projectView"
      />
    </template>

    <p class="border-t border-default px-5 py-8 text-sm text-muted">
      How the runs and the grading work, and what the numbers can't tell you yet:
      <NuxtLink
        to="/methodology"
        class="font-medium text-highlighted underline underline-offset-4"
      >methodology</NuxtLink>.
    </p>
  </div>
</template>

<style scoped>
.tab {
  position: relative;
  flex-shrink: 0;
  padding-block: 0.25rem;
  color: var(--ui-text-muted);
  transition: color 150ms ease;
}

.tab:hover,
.tab[aria-pressed="true"] {
  color: var(--ui-text-highlighted);
}

.tab[aria-pressed="true"]::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: -0.6875rem;
  height: 1px;
  background: var(--ui-text-highlighted);
}

.tab:focus-visible {
  outline: 2px solid var(--ui-text-highlighted);
  outline-offset: 2px;
}
</style>
