<script setup lang="ts">
import { ref } from "vue"
import { projectLabel, projectStack } from "#shared/labels"
import type { AgentRow } from "../utils/agents"
import { brokenRuns } from "../utils/agents"
import { duration, money } from "../utils/format"
import { tenScale } from "../utils/rubric"

/**
 * Every project side by side: one row per agent with each project's median score, Vite Doctor, vibe, cost and time,
 * under the reference apps. A project's name opens its own grid; an agent's row opens its runs.
 */
const route = useRoute()

const props = defineProps<{
  rows: AgentRow[]
  projects: string[]
  references: Record<string, { score: number, doctor: number | null, vibe: number | null } | null>
}>()

const columns = [
  { id: "score", label: "Score" },
  { id: "doctor", label: "Doctor", title: "Vite Doctor's diagnostics, 10% of the score" },
  { id: "vibe", label: "Vibe", title: "Design quality a linter can't see. Not part of the score." },
  { id: "cost", label: "Cost" },
  { id: "time", label: "Time" },
] as const

const open = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}

/** How many run rows an agent opens: its most runs in any project. */
const runCount = (row: AgentRow) => Math.max(...props.projects.map(project => row.byProject[project]?.runs.length ?? 0))
const totalRuns = (row: AgentRow) => props.projects.reduce((sum, project) => sum + (row.byProject[project]?.runs.length ?? 0), 0)
</script>

<template>
  <section class="px-6">
    <div class="relative overflow-x-auto">
      <table class="text-sm">
        <thead>
          <tr>
            <th class="sticky left-0 z-[1] bg-default" />
            <template
              v-for="(project, index) in projects"
              :key="project"
            >
              <th
                v-if="index"
                class="w-6"
              />
              <th
                :colspan="columns.length"
                class="pb-1 pl-1 text-left font-normal whitespace-nowrap"
              >
                <NuxtLink
                  :to="{ query: { ...route.query, task: project } }"
                  class="group inline-flex items-center gap-2 text-[13px]"
                  :title="`Every section of ${projectLabel(project)}, its charts and its failed checks`"
                >
                  <StackLogos :project="project" />
                  <span class="font-medium text-highlighted group-hover:underline group-hover:underline-offset-4">{{ projectLabel(project) }}</span>
                  <span
                    v-if="projectStack(project)"
                    class="rounded-sm bg-elevated px-1.5 text-[11px] leading-4 text-muted"
                  >{{ projectStack(project) }}</span>
                </NuxtLink>
              </th>
            </template>
          </tr>
          <tr>
            <th class="sticky left-0 z-[1] bg-default" />
            <template
              v-for="(project, index) in projects"
              :key="project"
            >
              <th v-if="index" />
              <th
                v-for="column in columns"
                :key="column.id"
                class="px-0.5 pb-1.5 pt-2 text-[11px] font-normal whitespace-nowrap text-muted"
                :class="column.id === 'cost' || column.id === 'time' ? 'pr-2 text-right' : 'text-center'"
                :title="'title' in column ? column.title : undefined"
              >
                {{ column.label }}
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap">
              <span class="font-medium text-highlighted">Reference app</span>
              <span class="ml-2 text-xs text-dimmed">built by hand</span>
            </th>
            <template
              v-for="(project, index) in projects"
              :key="project"
            >
              <td v-if="index" />
              <td class="px-0.5 py-2 text-center">
                <NuxtLink :to="`/projects/${project}`">
                  <ScoreCell
                    :score="references[project]?.score"
                    size="md"
                    :label="`${projectLabel(project)} reference app, score`"
                  />
                </NuxtLink>
              </td>
              <td class="px-0.5 py-2 text-center">
                <ScoreCell
                  :score="references[project]?.doctor"
                  :label="`${projectLabel(project)} reference app, Vite Doctor`"
                />
              </td>
              <td class="px-0.5 py-2 text-center">
                <ScoreCell
                  :score="references[project]?.vibe"
                  :label="`${projectLabel(project)} reference app, vibe`"
                />
              </td>
              <td colspan="2" />
            </template>
          </tr>
          <template
            v-for="row in rows"
            :key="row.key"
          >
            <tr>
              <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap max-sm:min-w-36 max-sm:whitespace-normal">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 text-left"
                  :aria-expanded="open.has(row.key)"
                  @click="toggle(row.key)"
                >
                  <UIcon
                    name="i-lucide-chevron-right"
                    class="size-3.5 shrink-0 text-dimmed transition-transform max-sm:hidden"
                    :class="{ 'rotate-90': open.has(row.key) }"
                  />
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :style="{ background: row.color }"
                  />
                  <span class="font-medium text-highlighted">{{ row.name }}</span>
                </button>
                <span class="ml-2 text-xs text-dimmed max-sm:ml-0 max-sm:block">{{ row.harness }} · {{ totalRuns(row) === 1 ? "1 run" : `${totalRuns(row)} runs` }}</span>
                <template
                  v-for="project in projects"
                  :key="project"
                >
                  <span
                    v-if="row.byProject[project] && brokenRuns(row.byProject[project])"
                    class="ml-2 rounded-sm bg-(--score-3)/20 px-1 text-[11px] text-warning"
                    :title="`A run that doesn't build or start scores 0, so the median of ${row.byProject[project].runs.map(run => tenScale(run.rubric.score)).join(', ')} is ${tenScale(row.byProject[project].score)}`"
                  >{{ brokenRuns(row.byProject[project]) }} of {{ row.byProject[project].runs.length }} runs broke</span>
                  <span
                    v-else-if="row.byProject[project]?.runs.every(run => run.diagnostics.error)"
                    class="ml-2 rounded-sm bg-(--score-3)/20 px-1 text-[11px] text-warning"
                    :title="`Every ${projectLabel(project)} run stopped at the time limit`"
                  >time limit</span>
                </template>
              </th>
              <template
                v-for="(project, index) in projects"
                :key="project"
              >
                <td v-if="index" />
                <td class="px-0.5 py-2 text-center">
                  <ScoreCell
                    :score="row.byProject[project]?.score"
                    size="md"
                    :label="row.byProject[project] ? `${row.name}, ${projectLabel(project)}, median score` : `${row.name}, ${projectLabel(project)}, not run yet`"
                  />
                </td>
                <td class="px-0.5 py-2 text-center">
                  <ScoreCell
                    :score="row.byProject[project]?.doctor"
                    :label="`${row.name}, ${projectLabel(project)}, Vite Doctor`"
                  />
                </td>
                <td class="px-0.5 py-2 text-center">
                  <ScoreCell
                    :score="row.byProject[project]?.vibe"
                    :label="`${row.name}, ${projectLabel(project)}, vibe`"
                  />
                </td>
                <td class="num">
                  {{ row.byProject[project]?.cost == null ? "–" : money(row.byProject[project]!.cost!) }}
                </td>
                <td class="num">
                  {{ row.byProject[project]?.ms == null ? "–" : duration(row.byProject[project]!.ms!) }}
                </td>
              </template>
            </tr>
            <template v-if="open.has(row.key)">
              <tr
                v-for="n in runCount(row)"
                :key="n"
              >
                <th class="sticky left-0 z-[1] bg-default py-1 pl-6 pr-5 text-left text-xs font-normal whitespace-nowrap text-muted">
                  Run {{ n }}
                </th>
                <template
                  v-for="(project, index) in projects"
                  :key="project"
                >
                  <td v-if="index" />
                  <template v-if="row.byProject[project]?.runs[n - 1]">
                    <td class="px-0.5 py-1 text-center">
                      <NuxtLink
                        :to="`/runs/${row.byProject[project]!.runs[n - 1]!.id}`"
                        class="inline-flex rounded-xs hover:outline-2 hover:outline-offset-1 hover:outline-(--ui-text-highlighted)"
                      >
                        <ScoreCell
                          :score="Math.round(row.byProject[project]!.runs[n - 1]!.rubric.score * 10) / 10"
                          :label="`${projectLabel(project)} run ${n}, score`"
                          class="h-5! text-xs!"
                        />
                      </NuxtLink>
                    </td>
                    <td class="px-0.5 py-1 text-center">
                      <ScoreCell
                        :score="row.byProject[project]!.runs[n - 1]!.rubric.doctor?.score"
                        :label="`${projectLabel(project)} run ${n}, Vite Doctor`"
                        class="h-5! text-xs!"
                      />
                    </td>
                    <td class="px-0.5 py-1 text-center">
                      <ScoreCell
                        :score="row.byProject[project]!.runs[n - 1]!.rubric.vibe?.score"
                        :label="`${projectLabel(project)} run ${n}, vibe`"
                        class="h-5! text-xs!"
                      />
                    </td>
                    <td class="num">
                      {{ money(row.byProject[project]!.runs[n - 1]!.usage.costUsd === undefined ? Number.NaN : Number(row.byProject[project]!.runs[n - 1]!.usage.costUsd)) }}
                    </td>
                    <td class="num">
                      {{ duration(row.byProject[project]!.runs[n - 1]!.durationMs) }}
                    </td>
                  </template>
                  <td
                    v-else
                    :colspan="columns.length"
                  />
                </template>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
    <p class="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-dimmed">
      <span class="mr-1">0 broken</span>
      <ScoreCell
        v-for="score in [1, 3, 5, 7, 9]"
        :key="score"
        :score="score"
        class="h-4! w-6! text-[10px]!"
      />
      <span class="ml-1">10 every check passes</span>
    </p>
    <p class="mt-1.5 text-xs text-dimmed">
      Medians of each agent's runs; – is a project the agent hasn't run yet. Open a project for its sections and the checks the runs fail.
    </p>
  </section>
</template>

<style scoped>
.num {
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
  text-align: right;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-muted);
}
</style>
