<script setup lang="ts">
import { computed, ref } from "vue"
import type { LocationQuery, LocationQueryRaw } from "vue-router"
import type { ProjectView, RunSummary } from "#shared/report"
import { projectKind, projectLabel } from "#shared/labels"
import type { ScatterGroup, ScatterPoint } from "../components/EvalScatter.vue"
import type { MatrixBlock } from "../components/ProjectsMatrix.vue"
import { agentsOf, runCost, runTokens } from "../utils/agents"
import type { Agent } from "../utils/agents"
import { agentsIn, blockScore, mean, modelKey, modelRows, topEfforts } from "../utils/models"
import { money, tokens } from "../utils/format"
import { median, scoreText } from "../utils/rubric"

definePageMeta({ bleed: true })

const { data: runs } = await useFetch<RunSummary[]>("/api/runs", { key: "runs", default: () => [] })

const route = useRoute()
const router = useRouter()

/** Graded runs at each model's one effort (utils/models): other efforts keep their run pages but leave this one. */
const graded = computed(() => {
  const all = runs.value.filter(run => run.rubric)
  const efforts = topEfforts(all)
  return all.filter(run => efforts.get(modelKey(run)) === run.reasoning)
})
/** Projects with graded runs, the one with the most runs first. */
const projects = computed(() => {
  const counts = new Map<string, number>()
  for (const run of graded.value) counts.set(run.project, (counts.get(run.project) ?? 0) + 1)
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b))
})

// The sidebar's filters live in the address, so a filtered view is a link: `?task=` one project (every project
// without it), `?agent=` the models to show (all of them without any).
const listOf = (value: unknown) => (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === "string" && item !== "")
/** The section whose failed checks the list shows; a section name in the grid sets it. */
const section = ref<string | null>(null)

// Two quick clicks would both start from the address before the first replace lands, and the second would undo the
// first; changes merge into the query still on its way.
let pending: LocationQuery | null = null
function setQuery(patch: LocationQueryRaw) {
  const query = { ...(pending ?? route.query), ...patch } as LocationQuery
  pending = query
  void router.replace({ query }).finally(() => {
    if (pending === query) pending = null
  })
}
const project = computed({
  get: () => projects.value.find(item => item === route.query.task) ?? null,
  set: (value) => {
    section.value = null
    setQuery({ task: value ?? undefined })
  },
})
const agentKeys = computed({
  get: () => listOf(route.query.agent),
  set: value => setQuery({ agent: value.length ? value : undefined }),
})

/** Build projects share the charts; fix and scan projects (an app with planted bugs) have theirs on their own pages. */
const buildProjects = computed(() => projects.value.filter(id => projectKind(id) === "build"))
const fixProjects = computed(() => projects.value.filter(id => projectKind(id) === "fix"))
const scanProjects = computed(() => projects.value.filter(id => projectKind(id) === "scan"))
/** The matrix's blocks: each build project, every fix case as one block, each hidden-bug project. */
const blocks = computed<MatrixBlock[]>(() => [
  ...buildProjects.value.map(id => ({ id, kind: "build" as const, label: projectLabel(id), projects: [id] })),
  ...(fixProjects.value.length ? [{ id: "fix", kind: "fix" as const, label: "Fix a reported bug", projects: fixProjects.value }] : []),
  ...scanProjects.value.map(id => ({ id, kind: "scan" as const, label: "Find hidden bugs", projects: [id] })),
])

/** Runs of the chosen project, before the model filter: the sidebar counts these. */
const scoped = computed(() => project.value ? graded.value.filter(run => run.project === project.value) : graded.value)
const shown = computed(() => graded.value.filter(run => !agentKeys.value.length || agentKeys.value.includes(modelKey(run))))

/** Every model over every project, unfiltered: its order and color hold on every view and filter. */
const allRows = computed(() => modelRows(graded.value, blocks.value.flatMap(block => block.projects)))
const colors = computed(() => new Map(allRows.value.map(row => [row.key, row.color])))
const rows = computed(() => modelRows(shown.value, blocks.value.flatMap(block => block.projects)).map(row => ({ ...row, color: colors.value.get(row.key) ?? row.color })))
/** A project's agents, one per model and setup; a model's setups share its color, and skills draw as diamonds. */
const agents = computed(() => project.value
  ? agentsOf(shown.value.filter(run => run.project === project.value)).map(agent => ({ ...agent, color: colors.value.get(modelKey(agent.runs[0]!)) ?? agent.color }))
  : [])

const filterAgents = computed(() => allRows.value.map(row => ({ key: row.key, name: row.name, color: row.color, runs: scoped.value.filter(run => modelKey(run) === row.key).length })))
const filterProjects = computed(() => projects.value.map(id => ({ id, runs: graded.value.filter(run => run.project === id).length })))

// This page shows the reference app's outcomes only. Its evidence and cited lines stay on the run and project pages,
// which is why the key differs from theirs.
const { data: projectView } = useAsyncData(() => `project-outcomes-${project.value ?? "all"}`, async () => {
  if (!project.value) return null
  const view = await $fetch<ProjectView>(`/api/projects/${project.value}`)
  return view.reference ? { ...view, reference: { ...view.reference, setupNotes: undefined, checks: view.reference.checks.map(check => ({ id: check.id, outcome: check.outcome, evidence: "" })) } } : view
}, { lazy: true })

type Reference = { score: number } | null
/** Each project's reference app scores, for the overview's top row. */
const { data: references } = useAsyncData("project-references", async () => {
  const views = await Promise.all(projects.value.map(id => $fetch<ProjectView>(`/api/projects/${id}`)))
  return Object.fromEntries(views.map(view => [view.project, view.reference ? { score: view.reference.score } : null])) as Record<string, Reference>
}, { lazy: true, default: () => ({}) as Record<string, Reference> })

const runCount = computed(() => project.value ? agents.value.reduce((sum, agent) => sum + agent.runs.length, 0) : shown.value.length)
const modelCount = computed(() => new Set((project.value ? agents.value.map(agent => modelKey(agent.runs[0]!)) : rows.value.map(row => row.key))).size)

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

const shapeOf = (agent: Agent) => agent.runs[0]!.setup === "A" ? "circle" as const : "diamond" as const

/** A run that doesn't build or start scores 0: it says nothing about cost or time against quality, so charts leave it out. */
const works = (run: RunSummary) => run.rubric!.score > 0

/** One project: every run, and each agent's median. */
function projectChart(axis: View) {
  const points: ScatterPoint[] = agents.value.flatMap(agent => agent.runs.filter(works).map(run => ({ id: run.id, group: `${agent.name} run ${run.n}`, x: xOf(run, axis), y: run.rubric.score / 10, tone: run.harness, color: agent.color, shape: shapeOf(agent) })))
    .filter(point => Number.isFinite(point.x) && point.x > 0)
  const groups: ScatterGroup[] = agents.value.flatMap((agent) => {
    const working = agent.runs.filter(works)
    const x = median(working.map(run => xOf(run, axis)).filter(value => Number.isFinite(value) && value > 0))
    const y = median(working.map(run => run.rubric.score))
    return x === null || y === null ? [] : [{ key: agent.key, label: `${agent.name}  ${scoreText(y)}`, x, y: y / 10, tone: agent.runs[0]!.harness, color: agent.color, shape: shapeOf(agent) }]
  })
  return { points, groups }
}

/**
 * Every project: one mark per model without skills and one with, at the arithmetic mean over the matrix's columns of
 * its score and of its median cost, time or tokens (Maxi, 2026-11-21). A model that ran fewer columns says how many.
 */
function overviewChart(axis: View) {
  const groups: ScatterGroup[] = rows.value.flatMap(row => (["bare", "skills"] as const).flatMap((side) => {
    const columns = blocks.value.filter(block => agentsIn(row[side], block).length)
    const y = mean(columns.map(block => blockScore(row[side], block)!))
    const x = mean(columns.flatMap((block) => {
      const values = agentsIn(row[side], block).map(agent => median(agent.runs.filter(works).map(run => xOf(run, axis)).filter(value => Number.isFinite(value) && value > 0)))
      const value = mean(values.filter((item): item is number => item !== null))
      return value === null ? [] : [value]
    }))
    if (x === null || y === null) return []
    const partial = columns.length < blocks.value.length ? ` · ${columns.length} of ${blocks.value.length}` : ""
    const tone = (Object.values(row[side])[0]?.runs[0]?.harness ?? "codex") as ScatterGroup["tone"]
    return [{ key: `${row.key}|${side}`, label: `${row.name}${side === "skills" ? " · skills" : ""}  ${scoreText(y)}${partial}`, x, y: y / 10, tone, color: row.color, shape: side === "bare" ? "circle" as const : "diamond" as const }]
  }))
  return { points: [] as ScatterPoint[], groups }
}

const charts = computed(() => views.map(view => ({ ...view, ...(project.value ? projectChart(view.id) : overviewChart(view.id)) })))

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
  <div class="grid min-h-[calc(100svh-3.25rem)] lg:grid-cols-[minmax(0,1fr)_17rem]">
    <div class="min-w-0">
      <div class="px-6 pt-8">
        <h1 class="text-lg font-medium text-highlighted">
          Nuxt + ViteHub agent evals
        </h1>
        <p class="mt-1.5 max-w-prose text-sm leading-6 text-pretty text-muted">
          Do skills make coding agents better at Nuxt? Each model gets the same tasks twice, once on its own and once with Nuxt MCP and nuxt-skills, or Vue skills on the Vue project. It builds a Nuxt 5 + ViteHub or Vue app, fixes a reported bug, and looks for hidden bugs. An Opus 5.5 judge scores every result from 0 to 100 against the project's rubric.
        </p>
        <p class="mt-3 text-[13px] text-muted">
          <template v-if="!project">
            {{ projects.length }} projects ·
          </template>
          {{ runCount === 1 ? "1 graded run" : `${runCount} graded runs` }} · {{ modelCount === 1 ? "1 model" : `${modelCount} models` }}
        </p>
      </div>

      <p
        v-if="!graded.length"
        class="px-6 py-16 text-sm text-muted"
      >
        No graded runs yet. Start one with <code class="font-mono text-highlighted">pnpm evals run meetups</code>.
      </p>
      <p
        v-else-if="!rows.length || (project && !agents.length)"
        class="px-6 py-16 text-sm text-muted"
      >
        No runs match these filters.
      </p>

      <template v-else>
        <template v-if="!project">
          <ProjectsMatrix
            class="pt-6"
            :rows="rows"
            :blocks="blocks"
            :references="references"
          />
        </template>
        <RubricResults
          v-else
          v-model:section="section"
          class="pt-4"
          part="sections"
          :agents="agents"
          :project="projectView"
        />

        <section
          v-for="item in charts"
          :key="item.id"
          class="flex flex-col px-6 pt-14"
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
            :y-format="(value: number) => scoreText(value * 10)"
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
                class="size-2"
                :class="group.shape === 'diamond' ? 'rotate-45 scale-90' : 'rounded-full'"
                :style="{ background: group.color }"
              />
              {{ group.label }}
            </li>
          </ul>
        </section>

        <RubricResults
          v-if="project"
          v-model:section="section"
          class="pt-14"
          part="checks"
          :agents="agents"
          :project="projectView"
        />
        <div class="h-16" />
      </template>
    </div>

    <aside
      v-if="graded.length"
      aria-label="Filters"
      class="border-default px-5 py-8 max-lg:order-first max-lg:pb-0 lg:sticky lg:top-13 lg:h-[calc(100svh-3.25rem)] lg:overflow-y-auto lg:border-l"
    >
      <ResultsFilters
        v-model:project="project"
        v-model:agents="agentKeys"
        :project-options="filterProjects"
        :total="graded.length"
        :agent-options="filterAgents"
      />
    </aside>
  </div>
</template>
