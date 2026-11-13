<script setup lang="ts">
import { computed, ref } from "vue"
import type { ProjectView, RunSummary } from "#shared/report"
import { projectLabel } from "#shared/labels"
import type { ScatterGroup, ScatterPoint } from "../components/EvalScatter.vue"
import { agentRows, agentsOf, runCost, runTokens } from "../utils/agents"
import type { Agent } from "../utils/agents"
import { money, tokens } from "../utils/format"
import { median, tenScale } from "../utils/rubric"

definePageMeta({ bleed: true })

const { data: runs } = await useFetch<RunSummary[]>("/api/runs", { key: "runs", default: () => [] })

const route = useRoute()

const graded = computed(() => runs.value.filter(run => run.rubric))
/** Projects with graded runs, the one with the most runs first. */
const projects = computed(() => {
  const counts = new Map<string, number>()
  for (const run of graded.value) counts.set(run.project, (counts.get(run.project) ?? 0) + 1)
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b))
})
/** `?task=` shows one project's sections, charts and failed checks; without it the page shows every project. */
const project = computed(() => projects.value.find(item => item === route.query.task) ?? null)

/** One row per agent over every project. Its color holds on every view. */
const rows = computed(() => agentRows(graded.value, projects.value))
const colors = computed(() => new Map(rows.value.map(row => [row.key, row.color])))
const agents = computed(() => project.value
  ? agentsOf(graded.value.filter(run => run.project === project.value)).map(agent => ({ ...agent, color: colors.value.get(agent.key) ?? agent.color }))
  : [])

// This page shows the reference app's outcomes only. Its evidence and cited lines stay on the run and project pages,
// which is why the key differs from theirs.
const { data: projectView } = useAsyncData(() => `project-outcomes-${project.value ?? "all"}`, async () => {
  if (!project.value) return null
  const view = await $fetch<ProjectView>(`/api/projects/${project.value}`)
  return view.reference ? { ...view, reference: { ...view.reference, setupNotes: undefined, checks: view.reference.checks.map(check => ({ id: check.id, outcome: check.outcome, evidence: "" })) } } : view
}, { lazy: true })

type Reference = { score: number, doctor: number | null, vibe: number | null } | null
/** Each project's reference app scores, for the overview's top row. */
const { data: references } = useAsyncData("project-references", async () => {
  const views = await Promise.all(projects.value.map(id => $fetch<ProjectView>(`/api/projects/${id}`)))
  return Object.fromEntries(views.map(view => [view.project, view.reference ? { score: view.reference.score, doctor: view.reference.doctor?.score ?? null, vibe: view.reference.vibe?.score ?? null } : null])) as Record<string, Reference>
}, { lazy: true, default: () => ({}) as Record<string, Reference> })

const checkCount = computed(() => projectView.value?.rubric?.checks.length)
const runCount = computed(() => project.value ? agents.value.reduce((sum, agent) => sum + agent.runs.length, 0) : graded.value.length)

/** The section whose failed checks the list shows; a section name in the grid sets it. */
const section = ref<string | null>(null)

const views = [
  { id: "cost", label: "Score against cost", axis: "Cost per run (USD, log scale)" },
  { id: "time", label: "Score against time", axis: "Time per run (log scale)" },
  { id: "tokens", label: "Score against tokens", axis: "Tokens per run (log scale)" },
] as const
type View = (typeof views)[number]["id"]

function xOf(run: RunSummary, axis: View): number {
  if (axis === "time") return run.durationMs / 60_000
  if (axis === "tokens") return runTokens(run)
  return runCost(run)
}

/** The agents a chart plots: one project's, or every project's, with the second project's marks as diamonds. */
const plotted = computed<{ agent: Agent, project: string, color: string }[]>(() => project.value
  ? agents.value.map(agent => ({ agent, project: project.value!, color: agent.color }))
  : rows.value.flatMap(row => projects.value.flatMap(id => row.byProject[id] ? [{ agent: row.byProject[id]!, project: id, color: row.color }] : [])))
const shapeOf = (id: string) => projects.value.indexOf(id) > 0 ? "diamond" as const : "circle" as const
const named = (agent: Agent, id: string) => project.value ? agent.name : `${agent.name} · ${projectLabel(id)}`

function chart(axis: View) {
  const points: ScatterPoint[] = plotted.value.flatMap(({ agent, project: id, color }) => agent.runs.map(run => ({ id: run.id, group: `${named(agent, id)} run ${run.n}`, x: xOf(run, axis), y: run.rubric.score / 10, tone: run.harness, color, shape: shapeOf(id) })))
    .filter(point => Number.isFinite(point.x) && point.x > 0)
  const groups: ScatterGroup[] = plotted.value.flatMap(({ agent, project: id, color }) => {
    const x = median(agent.runs.map(run => xOf(run, axis)).filter(value => Number.isFinite(value) && value > 0))
    return x === null ? [] : [{ key: `${agent.key}|${id}`, label: `${named(agent, id)}  ${tenScale(agent.score)}`, x, y: agent.score / 10, tone: agent.runs[0]!.harness, color, shape: shapeOf(id) }]
  })
  /** Agents left out because their runs have no value on this axis, such as a model with no list price yet. */
  const missing = plotted.value.filter(({ agent, project: id }) => !groups.some(group => group.key === `${agent.key}|${id}`)).map(({ agent, project: id }) => named(agent, id))
  return { points, groups, missing }
}
const charts = computed(() => views.map(view => ({ ...view, ...chart(view.id) })))

const formatters: Record<View, (value: number) => string> = {
  cost: value => money(value),
  time: value => value < 60 ? `${Math.round(value)} min` : `${(value / 60).toFixed(1).replace(/\.0$/, "")} h`,
  tokens: value => tokens(value),
}

function openRun(id: string) {
  void navigateTo(`/runs/${id}`)
}

useSeoMeta({ title: () => project.value ? `${projectLabel(project.value)} · Nuxt + ViteHub agent evals` : "Nuxt + ViteHub agent evals" })
</script>

<template>
  <div class="flex min-h-[calc(100svh-3.25rem)] min-w-0 flex-col">
    <div class="border-b border-default px-5 pb-6 pt-6">
      <h1 class="text-lg font-medium text-highlighted">
        Nuxt + ViteHub agent evals
      </h1>
      <p class="mt-1.5 max-w-prose text-sm leading-6 text-pretty text-muted">
        Can coding agents build a real app with Nuxt 5 and ViteHub, or with Vue alone? Each project gives an agent a short prompt and a folder that is empty or holds only the project's data. An Opus 5.5 judge grades the finished app from 0 to 10 on the project's rubric, and grades a reference app built by hand the same way.
      </p>
    </div>

    <div class="flex h-12 items-center gap-6 overflow-x-auto border-b border-default px-5 text-sm">
      <p
        v-if="project"
        class="text-[13px] text-muted"
      >
        <NuxtLink
          :to="`/projects/${project}`"
          class="text-default underline decoration-dimmed underline-offset-2 transition-colors hover:text-highlighted"
        >The prompt and the reference app</NuxtLink><template v-if="checkCount">
          · {{ checkCount }} checks</template> · {{ runCount === 1 ? "1 run" : `${runCount} runs` }}
      </p>
      <p
        v-else
        class="text-[13px] text-muted"
      >
        {{ projects.length }} projects · {{ runCount }} graded runs · {{ rows.length }} agents
      </p>
      <div
        v-if="projects.length"
        role="group"
        aria-label="Project"
        class="ml-auto flex flex-none items-center gap-1"
      >
        <UButton
          size="xs"
          color="neutral"
          :variant="project ? 'ghost' : 'soft'"
          :aria-pressed="!project"
          :to="{ query: { ...route.query, task: undefined } }"
          @click="section = null"
        >
          All projects
        </UButton>
        <UButton
          v-for="item in projects"
          :key="item"
          size="xs"
          color="neutral"
          :variant="project === item ? 'soft' : 'ghost'"
          :aria-pressed="project === item"
          :to="{ query: { ...route.query, task: item } }"
          @click="section = null"
        >
          <StackLogos :project="item" />
          {{ projectLabel(item) }}
        </UButton>
      </div>
    </div>

    <p
      v-if="!rows.length"
      class="px-5 py-16 text-center text-sm text-muted"
    >
      No graded runs yet. Start one with <code class="font-mono text-highlighted">pnpm evals run meetups</code>.
    </p>

    <template v-else>
      <ProjectsMatrix
        v-if="!project"
        :rows="rows"
        :projects="projects"
        :references="references"
      />
      <RubricResults
        v-else
        v-model:section="section"
        part="sections"
        :agents="agents"
        :project="projectView"
      />

      <section
        v-for="item in charts"
        :key="item.id"
        class="flex flex-col border-t border-default px-5 pb-8 pt-8"
      >
        <h2 class="text-sm font-medium text-highlighted">
          {{ item.label }}
        </h2>
        <EvalScatter
          class="mt-4 h-[26rem]"
          :points="item.points"
          :groups="item.groups"
          :x-label="item.axis"
          :log="true"
          :format="formatters[item.id]"
          :y-format="(value: number) => tenScale(value * 10)"
          :y-ticks="[0, 0.2, 0.4, 0.6, 0.8, 1]"
          @open="openRun"
        />
        <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] sm:hidden">
          <li
            v-for="group in item.groups"
            :key="group.key"
            class="flex items-center gap-2"
          >
            <span
              class="size-2 rounded-full"
              :style="{ background: group.color }"
            />
            {{ group.label }}
          </li>
        </ul>
        <p class="mt-3 text-xs text-dimmed">
          Each mark is a run; click one to open its session. The bigger mark is each agent's median.
          <template v-if="!project && projects.length > 1">
            Circles are {{ projectLabel(projects[0]!) }}, diamonds {{ projects.slice(1).map(projectLabel).join(", ") }}.
          </template>
          <template v-if="item.missing.length">
            Not shown: {{ item.missing.join(", ") }} ({{ item.id === "cost" ? "no list price yet" : "no data" }}).
          </template>
        </p>
      </section>

      <RubricResults
        v-if="project"
        v-model:section="section"
        part="checks"
        :agents="agents"
        :project="projectView"
      />
    </template>
  </div>
</template>
