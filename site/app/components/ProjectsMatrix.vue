<script setup lang="ts">
import { ref } from "vue"
import { projectLabel, projectStack } from "#shared/labels"
import type { Agent, AgentRow } from "../utils/agents"
import { brokenRuns, runCost } from "../utils/agents"
import { duration, money } from "../utils/format"
import { scoreText } from "../utils/rubric"

/**
 * Every eval side by side: one row per agent, one block of columns per eval, under the reference apps. A build
 * project is a block of its own. The fix projects share one block whose numbers are the mean over the cases (each
 * case counts once, by its median), and whose open rows show each case's run. The hidden-bug project is a block of
 * its own, with the planted bugs it found and the decoys it left alone in place of Doctor and vibe. A block's name
 * opens its grid; an agent's row opens its runs.
 */
export interface MatrixBlock {
  id: string
  kind: "build" | "fix" | "scan"
  label: string
  /** One project, or every fix case. */
  projects: string[]
}

const route = useRoute()

const props = defineProps<{
  rows: AgentRow[]
  blocks: MatrixBlock[]
  references: Record<string, { score: number, doctor: number | null, vibe: number | null } | null>
}>()

const columns = {
  build: [
    { id: "score", label: "Score" },
    { id: "second", label: "Doctor", title: "Vite Doctor's diagnostics, 10% of the score" },
    { id: "third", label: "Vibe", title: "Design quality a linter can't see. Not part of the score." },
  ],
  fix: [
    { id: "score", label: "Score", title: "Mean over the cases of each case's median score" },
    { id: "second", label: "Fixed", title: "Runs whose fix made the reported problem go away. A run that didn't scores 0." },
    { id: "third", label: "Vibe", title: "How smart the change is, mean over the cases. Not part of the score." },
  ],
  scan: [
    { id: "score", label: "Score" },
    { id: "second", label: "Found", title: "The critical and high planted bugs it found (section H)" },
    { id: "third", label: "Decoys", title: "Correct code that looks wrong, left alone (section D)" },
  ],
} as const
const tail = [{ id: "cost", label: "Cost" }, { id: "time", label: "Time" }] as const
const width = 5

const finiteMean = (values: (number | null | undefined)[]) => {
  const list = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value))
  return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null
}
const fixed = (agent: Agent) => agent.runs.filter(run => run.rubric.started && !run.rubric.gateFailed?.length).length

interface Cell {
  score: number | null
  second: number | string | null
  third: number | null
  cost: number | null
  ms: number | null
}

function cell(row: AgentRow, block: MatrixBlock): Cell | null {
  const agents = block.projects.map(project => row.byProject[project]).filter((agent): agent is Agent => !!agent)
  if (!agents.length) return null
  if (block.kind === "fix") {
    const runs = agents.reduce((sum, agent) => sum + agent.runs.length, 0)
    return {
      score: finiteMean(agents.map(agent => agent.score)),
      second: `${agents.reduce((sum, agent) => sum + fixed(agent), 0)} of ${runs}`,
      third: finiteMean(agents.map(agent => agent.vibe)),
      cost: finiteMean(agents.map(agent => agent.cost)),
      ms: finiteMean(agents.map(agent => agent.ms)),
    }
  }
  const [agent] = agents
  return {
    score: agent!.score,
    second: block.kind === "scan" ? agent!.sections.H ?? null : agent!.doctor,
    third: block.kind === "scan" ? agent!.sections.D ?? null : agent!.vibe,
    cost: agent!.cost,
    ms: agent!.ms,
  }
}

function referenceCell(block: MatrixBlock) {
  const references = block.projects.map(project => props.references[project]).filter(reference => !!reference)
  if (!references.length) return null
  if (block.kind === "fix") return { score: finiteMean(references.map(reference => reference.score)), second: null, third: finiteMean(references.map(reference => reference.vibe)) }
  return { score: references[0]!.score, second: block.kind === "build" ? references[0]!.doctor : null, third: block.kind === "build" ? references[0]!.vibe : null }
}

/** Run `n` of an agent in a block: one run, or each fix case's run `n`. */
function runsAt(row: AgentRow, block: MatrixBlock, n: number) {
  return block.projects.flatMap((project) => {
    const run = row.byProject[project]?.runs[n - 1]
    return run ? [{ project, run }] : []
  })
}

const open = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}

const allProjects = () => props.blocks.flatMap(block => block.projects)
/** How many run rows an agent opens: its most runs in any project. */
const runCount = (row: AgentRow) => Math.max(...allProjects().map(project => row.byProject[project]?.runs.length ?? 0))
const totalRuns = (row: AgentRow) => allProjects().reduce((sum, project) => sum + (row.byProject[project]?.runs.length ?? 0), 0)
const buildBlocks = () => props.blocks.filter(block => block.kind === "build")
const fixBlock = () => props.blocks.find(block => block.kind === "fix")

/** The block's own grid: a project's, or for the fix block the first case's (the sidebar picks the others). */
const blockLink = (block: MatrixBlock) => ({ query: { ...route.query, task: block.projects[0] } })
const blockChip = (block: MatrixBlock) => block.kind === "fix" ? `${block.projects.length} cases` : projectStack(block.projects[0]!)
</script>

<template>
  <section class="px-6">
    <div class="relative overflow-x-auto">
      <table class="text-sm">
        <thead>
          <tr>
            <th class="sticky left-0 z-[1] bg-default" />
            <template
              v-for="(block, index) in blocks"
              :key="block.id"
            >
              <th
                v-if="index"
                class="w-6"
              />
              <th
                :colspan="width"
                class="pb-1 pl-1 text-left font-normal whitespace-nowrap"
              >
                <NuxtLink
                  :to="blockLink(block)"
                  class="group inline-flex items-center gap-2 text-[13px]"
                  :title="block.kind === 'fix' ? `Each case's grid: ${block.projects.map(projectLabel).join(', ')}` : `Every section of ${block.label}, its charts and its failed checks`"
                >
                  <StackLogos :project="block.projects[0]!" />
                  <span class="font-medium text-highlighted group-hover:underline group-hover:underline-offset-4">{{ block.label }}</span>
                  <span
                    v-if="blockChip(block)"
                    class="rounded-sm bg-elevated px-1.5 text-[11px] leading-4 text-muted"
                  >{{ blockChip(block) }}</span>
                </NuxtLink>
              </th>
            </template>
          </tr>
          <tr>
            <th class="sticky left-0 z-[1] bg-default" />
            <template
              v-for="(block, index) in blocks"
              :key="block.id"
            >
              <th v-if="index" />
              <th
                v-for="column in [...columns[block.kind], ...tail]"
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
              v-for="(block, index) in blocks"
              :key="block.id"
            >
              <td v-if="index" />
              <td class="px-0.5 py-2 text-center">
                <NuxtLink :to="`/projects/${block.projects[0]}`">
                  <ScoreCell
                    :score="referenceCell(block)?.score"
                    size="md"
                    :label="`${block.label} reference, score`"
                  />
                </NuxtLink>
              </td>
              <td class="px-0.5 py-2 text-center">
                <ScoreCell
                  v-if="block.kind === 'build'"
                  :score="referenceCell(block)?.second"
                  :label="`${block.label} reference app, Vite Doctor`"
                />
              </td>
              <td class="px-0.5 py-2 text-center">
                <ScoreCell
                  v-if="block.kind !== 'scan'"
                  :score="referenceCell(block)?.third"
                  :label="`${block.label} reference, vibe`"
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
                  v-for="block in buildBlocks()"
                  :key="block.id"
                >
                  <span
                    v-if="row.byProject[block.id] && brokenRuns(row.byProject[block.id]!)"
                    class="ml-2 rounded-sm bg-(--score-3)/20 px-1 text-[11px] text-warning"
                    :title="`A run that doesn't build or start scores 0, so the median of ${row.byProject[block.id]!.runs.map(run => scoreText(run.rubric.score)).join(', ')} is ${scoreText(row.byProject[block.id]!.score)}`"
                  >{{ brokenRuns(row.byProject[block.id]!) }} of {{ row.byProject[block.id]!.runs.length }} runs broke</span>
                  <span
                    v-else-if="row.byProject[block.id]?.runs.every(run => run.diagnostics.error)"
                    class="ml-2 rounded-sm bg-(--score-3)/20 px-1 text-[11px] text-warning"
                    :title="`Every ${block.label} run stopped at the time limit`"
                  >time limit</span>
                </template>
              </th>
              <template
                v-for="(block, index) in blocks"
                :key="block.id"
              >
                <td v-if="index" />
                <template v-if="cell(row, block)">
                  <td class="px-0.5 py-2 text-center">
                    <ScoreCell
                      :score="cell(row, block)!.score"
                      size="md"
                      :label="`${row.name}, ${block.label}, ${block.kind === 'fix' ? 'mean over the cases' : 'median score'}`"
                    />
                  </td>
                  <td
                    v-if="block.kind === 'fix'"
                    class="px-1 py-2 text-center text-xs whitespace-nowrap tabular-nums text-muted"
                  >
                    {{ cell(row, block)!.second }}
                  </td>
                  <td
                    v-else
                    class="px-0.5 py-2 text-center"
                  >
                    <ScoreCell
                      :score="cell(row, block)!.second as number | null"
                      :label="`${row.name}, ${block.label}, ${columns[block.kind][1].label}`"
                    />
                  </td>
                  <td class="px-0.5 py-2 text-center">
                    <ScoreCell
                      :score="cell(row, block)!.third"
                      :label="`${row.name}, ${block.label}, ${columns[block.kind][2].label}`"
                    />
                  </td>
                  <td class="num">
                    {{ cell(row, block)!.cost == null ? "–" : money(cell(row, block)!.cost!) }}
                  </td>
                  <td class="num">
                    {{ cell(row, block)!.ms == null ? "–" : duration(cell(row, block)!.ms!) }}
                  </td>
                </template>
                <template v-else>
                  <td class="px-0.5 py-2 text-center">
                    <ScoreCell
                      :score="null"
                      size="md"
                      :label="`${row.name}, ${block.label}, not run yet`"
                    />
                  </td>
                  <td class="px-0.5 py-2 text-center">
                    <ScoreCell :score="null" />
                  </td>
                  <td class="px-0.5 py-2 text-center">
                    <ScoreCell :score="null" />
                  </td>
                  <td class="num">
                    –
                  </td>
                  <td class="num">
                    –
                  </td>
                </template>
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
                  v-for="(block, index) in blocks"
                  :key="block.id"
                >
                  <td v-if="index" />
                  <template v-if="block.kind === 'fix' && runsAt(row, block, n).length">
                    <td
                      colspan="3"
                      class="px-0.5 py-1"
                    >
                      <span class="flex justify-center gap-0.5">
                        <NuxtLink
                          v-for="item in runsAt(row, block, n)"
                          :key="item.project"
                          :to="`/runs/${item.run.id}`"
                          class="inline-flex rounded-xs hover:outline-2 hover:outline-offset-1 hover:outline-(--ui-text-highlighted)"
                        >
                          <ScoreCell
                            :score="Math.round(item.run.rubric.score * 10) / 10"
                            :label="`${projectLabel(item.project)} run ${n}, score`"
                            class="h-5! w-6! text-[10px]!"
                          />
                        </NuxtLink>
                      </span>
                    </td>
                    <td class="num">
                      {{ money(finiteMean(runsAt(row, block, n).map(item => runCost(item.run))) ?? Number.NaN) }}
                    </td>
                    <td class="num">
                      {{ duration(finiteMean(runsAt(row, block, n).map(item => item.run.durationMs)) ?? Number.NaN) }}
                    </td>
                  </template>
                  <template v-else-if="block.kind !== 'fix' && runsAt(row, block, n)[0]">
                    <td class="px-0.5 py-1 text-center">
                      <NuxtLink
                        :to="`/runs/${runsAt(row, block, n)[0]!.run.id}`"
                        class="inline-flex rounded-xs hover:outline-2 hover:outline-offset-1 hover:outline-(--ui-text-highlighted)"
                      >
                        <ScoreCell
                          :score="Math.round(runsAt(row, block, n)[0]!.run.rubric.score * 10) / 10"
                          :label="`${block.label} run ${n}, score`"
                          class="h-5! text-xs!"
                        />
                      </NuxtLink>
                    </td>
                    <td class="px-0.5 py-1 text-center">
                      <ScoreCell
                        :score="block.kind === 'scan' ? runsAt(row, block, n)[0]!.run.rubric.sections.find(section => section.key === 'H')?.score : runsAt(row, block, n)[0]!.run.rubric.doctor?.score"
                        :label="`${block.label} run ${n}, ${columns[block.kind][1].label}`"
                        class="h-5! text-xs!"
                      />
                    </td>
                    <td class="px-0.5 py-1 text-center">
                      <ScoreCell
                        :score="block.kind === 'scan' ? runsAt(row, block, n)[0]!.run.rubric.sections.find(section => section.key === 'D')?.score : runsAt(row, block, n)[0]!.run.rubric.vibe?.score"
                        :label="`${block.label} run ${n}, ${columns[block.kind][2].label}`"
                        class="h-5! text-xs!"
                      />
                    </td>
                    <td class="num">
                      {{ money(runCost(runsAt(row, block, n)[0]!.run)) }}
                    </td>
                    <td class="num">
                      {{ duration(runsAt(row, block, n)[0]!.run.durationMs) }}
                    </td>
                  </template>
                  <td
                    v-else
                    :colspan="width"
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
      <span class="ml-1">100 every check passes</span>
    </p>
    <p class="mt-1.5 text-xs text-dimmed">
      Medians of each agent's runs; – is an eval the agent hasn't run yet. Open an eval for its sections and where agents fall short.
    </p>
    <p
      v-if="fixBlock()"
      class="mt-1.5 max-w-prose text-xs text-dimmed"
    >
      Fix a reported bug is the mean of {{ fixBlock()!.projects.length }} cases; an open row shows each case's run in this order:
      <template
        v-for="(project, index) in fixBlock()!.projects"
        :key="project"
      >
        <NuxtLink
          :to="{ query: { ...route.query, task: project } }"
          class="hover:text-highlighted hover:underline hover:underline-offset-2"
        >{{ projectLabel(project) }}</NuxtLink>{{ index < fixBlock()!.projects.length - 1 ? ", " : "." }}
      </template>
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
