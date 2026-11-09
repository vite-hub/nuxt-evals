<script setup lang="ts">
import { computed } from "vue"
import type { Harness, ProjectView, RunSummary } from "#shared/report"
import { harnessLabel, modelLabel, projectLabel } from "#shared/labels"
import type { ScatterGroup, ScatterPoint } from "../components/EvalScatter.vue"
import { day, duration, money, percent, seconds, tokens } from "../utils/format"
import { fiveScale } from "../utils/rubric"

definePageMeta({ bleed: true })

const { data: runs } = await useFetch<RunSummary[]>("/api/runs", { key: "runs", default: () => [] })

const route = useRoute()
const router = useRouter()

const views = [
  { id: "cost", label: "Score vs cost", axis: "Cost per run (USD, log scale)" },
  { id: "time", label: "Score vs time", axis: "Time per run (log scale)" },
  { id: "tokens", label: "Score vs tokens", axis: "Tokens per run (log scale)" },
] as const
type View = (typeof views)[number]["id"]
const harnesses: Harness[] = ["codex", "claude-code"]
const setups = ["A", "B", "C"] as const
const setupLabels = { A: "Bare", B: "Nuxt MCP + core skill", C: "B + module skills" }

function listQuery(name: string): string[] | undefined {
  const value = route.query[name]
  return typeof value === "string" && value ? value.split(",") : undefined
}

const projects = computed(() => [...new Set(runs.value.map(run => run.project))].sort())
// The newest project leads; older ones stay one click away. Runs come newest first.
const project = computed(() => typeof route.query.project === "string" && projects.value.includes(route.query.project) ? route.query.project : runs.value[0]?.project)
const shownHarnesses = computed(() => listQuery("harness") ?? harnesses)
const shownSetups = computed(() => listQuery("setup") ?? [...setups])

function setQuery(patch: Record<string, string | undefined>) {
  void router.replace({ query: { ...route.query, ...patch } })
}

function toggle(name: "harness" | "setup", value: string, all: readonly string[]) {
  const current = name === "harness" ? shownHarnesses.value : shownSetups.value
  const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
  setQuery({ [name]: next.length === all.length ? undefined : next.join(",") })
}

const projectRuns = computed(() => runs.value.filter(run => run.project === project.value))
/** Rubric projects score 1 to 5 per section (the Opus judge); older projects score the share of probes passed. */
const rubricMode = computed(() => projectRuns.value.some(run => run.rubric))
const { data: projectView } = useFetch<ProjectView>(() => `/api/projects/${project.value}`, { key: () => `project-${project.value}`, lazy: true, immediate: Boolean(project.value) })
/** A score as the page prints it: "4.2 of 5" for rubric runs (score is mean/5), "91%" for probe runs. */
const scoreText = (value: number) => rubricMode.value ? fiveScale(value * 5) : percent(value)
/** Rubric projects open on the section scores; the charts are the other tabs. */
const tabs = computed(() => [...(rubricMode.value ? [{ id: "sections" as const, label: "Sections" }] : []), ...views])
type Tab = View | "sections"
const tab = computed<Tab>(() => tabs.value.find(item => item.id === route.query.view)?.id ?? tabs.value[0]!.id)
const view = computed<View>(() => tab.value === "sections" ? "cost" : tab.value)
const shown = computed(() => projectRuns.value.filter(run => shownHarnesses.value.includes(run.harness) && shownSetups.value.includes(run.setup)))

function count(list: RunSummary[], predicate: (run: RunSummary) => boolean): number {
  return list.filter(predicate).length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

function totalTokens(run: RunSummary): number {
  return run.usage.totalTokens ?? (run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0)
}

function xOf(run: RunSummary, axis: View): number {
  if (axis === "time") return run.durationMs / 1000
  if (axis === "tokens") return totalTokens(run)
  return Number(run.usage.costUsd ?? Number.NaN)
}

function groupKey(run: RunSummary): string {
  return [run.harness, run.model, run.reasoning, run.setup].join("|")
}

function groupLabel(run: RunSummary): string {
  return `${harnessLabel(run.harness)} · ${modelLabel(run.model)} ${run.reasoning} · ${run.setup}`
}

/** Runs with the same harness, model, effort and setup. Their median is what the chart labels. */
const groups = computed(() => {
  const map = new Map<string, RunSummary[]>()
  for (const run of shown.value) map.set(groupKey(run), [...(map.get(groupKey(run)) ?? []), run])
  return [...map.entries()].map(([key, list]) => {
    const scores = list.map(run => run.score)
    return {
      key,
      label: groupLabel(list[0]!),
      harness: list[0]!.harness,
      runs: list,
      median: median(scores),
      min: Math.min(...scores),
      max: Math.max(...scores),
      cost: median(list.map(run => Number(run.usage.costUsd ?? 0))),
      time: median(list.map(run => run.durationMs / 1000)),
    }
  }).sort((a, b) => b.median - a.median)
})

const points = computed<ScatterPoint[]>(() => shown.value
  .map(run => ({ id: run.id, group: groupLabel(run), x: xOf(run, view.value), y: run.score, tone: run.harness }))
  .filter(point => Number.isFinite(point.x)))

const medians = computed<ScatterGroup[]>(() => groups.value.map(group => ({
  key: group.key,
  label: `${group.label}  ${scoreText(group.median)}`,
  x: median(group.runs.map(run => xOf(run, view.value)).filter(Number.isFinite)),
  y: group.median,
  tone: group.harness,
})))

const formatters: Record<View, (value: number) => string> = {
  cost: value => money(value),
  time: value => duration(value * 1000),
  tokens: value => tokens(value),
}

/** Probe titles in task order, with the pass count of each group. */
const probeRows = computed(() => {
  const titles = new Map<string, { title: string, layer: string }>()
  for (const run of shown.value) for (const probe of run.probes) if (!titles.has(probe.id)) titles.set(probe.id, probe)
  return [...titles.entries()].map(([id, probe]) => ({
    id,
    ...probe,
    cells: groups.value.map((group) => {
      const results = group.runs.map(run => run.probes.find(item => item.id === id)?.passed)
      return { key: group.key, passed: results.filter(Boolean).length, total: results.length }
    }),
  }))
})

const best = computed(() => groups.value[0])
const totalCost = computed(() => shown.value.reduce((sum, run) => sum + Number(run.usage.costUsd ?? 0), 0))

function openRun(id: string) {
  void navigateTo(`/runs/${id}`)
}

useSeoMeta({ title: () => project.value ? `${projectLabel(project.value)} · Nuxt agent evals` : "Nuxt agent evals" })
</script>

<template>
  <div class="grid min-h-[calc(100svh-3.25rem)] lg:grid-cols-[minmax(0,1fr)_17.5rem]">
    <div class="flex min-w-0 flex-col">
      <div class="flex flex-wrap items-end gap-x-10 gap-y-4 border-b border-default px-5 pb-6 pt-6">
        <div>
          <h1 class="text-lg font-medium text-highlighted">
            {{ project ? projectLabel(project) : "Nuxt agent evals" }}
          </h1>
          <p class="mt-1 max-w-prose text-sm text-pretty text-muted">
            <template v-if="rubricMode">
              Coding agents build a Meetups app with Nuxt nightly and ViteHub from a short, vague prompt, starting in an empty folder. An Opus 5.5 judge grades each app against a 203-check rubric, and the reference app against the same rubric.
            </template>
            <template v-else>
              Coding agents build a Nuxt 5 app from a product spec. Probes grade what the app does and how it is built.
            </template>
            <NuxtLink
              v-if="project"
              :to="`/projects/${project}`"
              class="text-default underline decoration-dimmed underline-offset-2 transition-colors hover:text-highlighted"
            >{{ rubricMode ? "See the prompt, the rubric and the reference app" : "See the starting app and the prompt" }}</NuxtLink>
          </p>
        </div>
        <dl
          v-if="best"
          class="ml-auto flex gap-8 text-right"
        >
          <div>
            <dt class="text-xs text-muted">
              Best median score
            </dt>
            <dd class="stat tone-text" :class="best.harness">
              {{ scoreText(best.median) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Runs
            </dt>
            <dd class="stat text-highlighted">
              {{ shown.length }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Spent
            </dt>
            <dd class="stat text-highlighted">
              {{ money(totalCost) }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="flex h-12 items-center gap-6 overflow-x-auto border-b border-default px-5 text-sm">
        <button
          v-for="item in tabs"
          :key="item.id"
          type="button"
          class="tab"
          :aria-pressed="tab === item.id"
          @click="setQuery({ view: item.id === tabs[0]!.id ? undefined : item.id })"
        >
          {{ item.label }}
        </button>
      </div>

      <RubricResults
        v-if="tab === 'sections'"
        part="sections"
        :runs="shown"
        :project="projectView"
      />

      <section
        v-else
        class="flex flex-col px-5 pb-4 pt-4"
        :class="rubricMode ? 'h-[30rem]' : 'min-h-[34rem] flex-1 lg:h-[calc(100svh-6.25rem)]'"
      >
        <div
          v-if="!shown.length"
          class="flex flex-1 items-center justify-center text-sm text-muted"
        >
          <p>
            No runs match. Start one with <code class="font-mono text-highlighted">pnpm evals run {{ project ?? "meetups-v2" }}</code>, or clear the filters.
          </p>
        </div>

        <EvalScatter
          v-else
          class="mt-6 flex-1"
          :points="points"
          :groups="medians"
          :x-label="views.find(item => item.id === view)!.axis"
          :log="true"
          :format="formatters[view]"
          :y-format="rubricMode ? (value: number) => fiveScale(value * 5) : undefined"
          :y-ticks="rubricMode ? [0.2, 0.4, 0.6, 0.8, 1] : undefined"
          @open="openRun"
        />

      </section>

      <RubricResults
        v-if="rubricMode"
        part="checks"
        :runs="shown"
        :project="projectView"
      />

      <section class="border-t border-default px-5 pb-10 pt-8">
        <h2 class="text-sm font-medium text-highlighted">
          Runs
        </h2>
        <ul class="mt-3 text-sm">
          <li
            v-for="run in shown"
            :key="run.id"
            class="row grid grid-cols-[0.375rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5 md:grid-cols-[0.375rem_minmax(0,1fr)_4rem_5rem_4.5rem_7.5rem_4rem]"
          >
            <span
              class="size-1.5 self-center rounded-full"
              :class="run.status === 'passed' ? 'bg-(--pass)' : 'bg-(--fail)'"
              :title="run.status"
            />
            <NuxtLink
              :to="`/runs/${run.id}`"
              class="truncate hover:underline hover:underline-offset-4"
            >
              <span class="font-medium text-highlighted">{{ harnessLabel(run.harness) }}</span>
              <span class="text-muted">{{ ` ${modelLabel(run.model)} ${run.reasoning} · ${run.setup}${run.repeat}` }}</span>
            </NuxtLink>
            <span class="hidden text-right tabular-nums font-medium text-highlighted md:block">{{ scoreText(run.score) }}</span>
            <span class="hidden text-right tabular-nums text-muted md:block">{{ money(Number(run.usage.costUsd ?? 0)) }}</span>
            <span class="hidden text-right tabular-nums text-muted md:block">{{ seconds(run.durationMs) }}</span>
            <time
              :datetime="run.startedAt"
              class="hidden whitespace-nowrap text-right tabular-nums text-dimmed md:block"
            >{{ day(run.startedAt) }}</time>
            <NuxtLink
              :to="`/runs/${run.id}`"
              class="link justify-self-end"
            >Session</NuxtLink>
          </li>
        </ul>
      </section>

      <section
        v-if="probeRows.length"
        class="border-t border-default px-5 pb-16 pt-8"
      >
        <h2 class="text-sm font-medium text-highlighted">
          Probes
        </h2>
        <p class="mt-1 text-sm text-muted">
          Runs in each group that passed the probe.
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-muted">
                <th class="py-2 pr-4 font-normal">
                  Probe
                </th>
                <th
                  v-for="group in groups"
                  :key="group.key"
                  class="w-40 py-2 pr-4 text-right font-normal"
                >
                  <span class="tone-text" :class="group.harness">{{ group.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in probeRows"
                :key="row.id"
                class="border-t border-default"
              >
                <td class="py-2.5 pr-4">
                  <span class="text-highlighted"><template
                    v-for="(part, index) in row.title.split('`')"
                    :key="index"
                  ><code
                    v-if="index % 2"
                    class="font-mono text-[0.85em]"
                  >{{ part }}</code><template v-else>{{ part }}</template></template></span>
                  <span class="ml-2 text-xs text-dimmed">{{ row.layer }}</span>
                </td>
                <td
                  v-for="cell in row.cells"
                  :key="cell.key"
                  class="py-2.5 pr-4 text-right tabular-nums"
                  :class="cell.total && cell.passed === cell.total ? 'text-(--pass)' : cell.passed ? 'text-default' : 'text-(--fail)'"
                >
                  {{ cell.passed }}/{{ cell.total }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <aside class="border-default max-lg:border-t lg:sticky lg:top-13 lg:h-[calc(100svh-3.25rem)] lg:overflow-y-auto lg:border-l">
      <div class="space-y-8 px-5 py-6 text-sm">
        <div v-if="projects.length > 1">
          <h2 class="filter-title">
            Project
          </h2>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button
              v-for="item in projects"
              :key="item"
              type="button"
              class="tab"
              :aria-pressed="project === item"
              @click="setQuery({ project: item })"
            >
              {{ projectLabel(item) }}
            </button>
          </div>
        </div>

        <fieldset>
          <legend class="filter-title">
            Harness
          </legend>
          <label
            v-for="harness in harnesses"
            :key="harness"
            class="filter-row"
          >
            <input
              type="checkbox"
              class="check"
              :checked="shownHarnesses.includes(harness)"
              @change="toggle('harness', harness, harnesses)"
            >
            <span class="swatch" :class="harness" />
            <span class="text-highlighted">{{ harnessLabel(harness) }}</span>
            <span class="ml-auto tabular-nums text-dimmed">{{ count(projectRuns, run => run.harness === harness) }}</span>
          </label>
        </fieldset>

        <fieldset>
          <legend class="filter-title">
            Setup
          </legend>
          <label
            v-for="setup in setups"
            :key="setup"
            class="filter-row"
            :class="{ 'opacity-50': !count(projectRuns, run => run.setup === setup) }"
          >
            <input
              type="checkbox"
              class="check"
              :checked="shownSetups.includes(setup)"
              @change="toggle('setup', setup, setups)"
            >
            <span class="w-4 font-mono text-xs text-muted">{{ setup }}</span>
            <span class="text-highlighted">{{ setupLabels[setup] }}</span>
            <span class="ml-auto tabular-nums text-dimmed">{{ count(projectRuns, run => run.setup === setup) }}</span>
          </label>
        </fieldset>

        <div
          v-if="groups.length"
          class="border-t border-default pt-6"
        >
          <h2 class="filter-title">
            Median score
          </h2>
          <ol class="mt-2 space-y-2">
            <li
              v-for="group in groups"
              :key="group.key"
              class="flex items-baseline gap-2"
            >
              <span class="swatch" :class="group.harness" />
              <span class="min-w-0 flex-1 truncate text-muted">{{ group.label }}</span>
              <span class="tabular-nums font-medium text-highlighted">{{ scoreText(group.median) }}</span>
            </li>
          </ol>
        </div>

        <details class="border-t border-default pt-6 text-muted">
          <summary class="cursor-pointer text-highlighted">
            Method
          </summary>
          <div class="mt-3 space-y-3 text-pretty leading-6">
            <template v-if="rubricMode">
              <p>Each run starts in an empty folder with an empty home folder, through the agent's own CLI, and gets only the prompt. Setup A has no Nuxt MCP and no skills.</p>
              <p>Claude Code with Opus 5.5 grades the finished app: one session installs, builds and starts it, four more grade the sections against the running app and the code, with evidence for each check. The section scores come from the rubric's rules, not from the judge.</p>
              <p>Cost is the agent's estimate from models.dev list prices; the judge is not included.</p>
            </template>
            <template v-else>
              <p>Each run starts from the same partly built app with an empty home folder, through the agent's own CLI. Setup A has no Nuxt MCP and no skills.</p>
              <p>Gate probes (build, start) must pass for a score. The score is the share of probes passed. Cost is an estimate from models.dev list prices.</p>
            </template>
            <p>Each run's page has the whole session: the thinking, the commands with their output, and the files.</p>
          </div>
        </details>
      </div>
    </aside>
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

.stat {
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.filter-title {
  font-weight: 500;
  color: var(--ui-text-highlighted);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
  cursor: pointer;
}

.check {
  width: 0.875rem;
  height: 0.875rem;
  accent-color: var(--ui-text-highlighted);
}

.swatch {
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
  border-radius: 999px;
}

.swatch.codex {
  background: var(--tone-codex);
}

.swatch.claude-code {
  background: var(--tone-claude);
}
</style>
