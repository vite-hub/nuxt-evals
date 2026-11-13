<script setup lang="ts">
import { computed, ref } from "vue"
import type { ProjectView } from "#shared/report"
import { projectStack } from "#shared/labels"
import type { Agent } from "../utils/agents"
import { duration, money, tokens } from "../utils/format"
import { tenScale, plainCheck } from "../utils/rubric"

/**
 * The rubric view of every graded run. `sections`: one row per agent with its median section scores, under the
 * reference app's row; an agent's row opens its runs. `checks`: the checks the runs fail, most often first.
 */
const props = defineProps<{ agents: Agent[], project?: ProjectView | null, part: "sections" | "checks" }>()
/** The section whose failed checks the list shows. A section name in the grid sets it. */
const section = defineModel<string | null>("section", { default: null })

const sections = computed(() => props.project?.rubric?.sections ?? [])
const checks = computed(() => new Map(props.project?.rubric?.checks.map(check => [check.id, check]) ?? []))
const reference = computed(() => props.project?.reference)
/** Short names for the grid's headers, per project: section letters mean different things in each rubric. */
const shortNames: Record<string, Record<string, string>> = {
  "meetups": {
    P: "Features work",
    R: "Server routes",
    A: "Auth",
    F: "Files and conventions",
    G: "Error handling",
    K: "Deploy and config",
    I: "ViteHub setup",
    J: "ViteHub Database",
    L: "ViteHub Auth",
    M: "ViteHub Email",
    O: "ViteHub Blob",
    N: "ViteHub Jobs",
    Z: "Agent checked its work",
  },
  "meal-planner": {
    P: "Features work",
    S: "State and data",
    N: "Units and amounts",
    T: "Dates and weeks",
    Q: "Vue and reactivity",
    V: "Forms and import",
    X: "Security",
    G: "Error handling",
    F: "Code organization",
    K: "Build and deploy",
    Z: "Agent checked its work",
  },
}
const short = computed(() => shortNames[props.project?.project ?? ""] ?? {})
const sectionName = (key: string) => short.value[key] ?? sections.value.find(item => item.key === key)?.title ?? key
const sectionTitle = (key: string) => sections.value.find(item => item.key === key)?.title ?? key
const scoreOf = (grade: { sections: { key: string, score: number | null }[] }, key: string) => grade.sections.find(item => item.key === key)?.score ?? null

const open = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}

const runs = computed(() => props.agents.flatMap(agent => agent.runs.map(run => ({ run, agent }))))

/** The first sentence of a check, without its grading notes in parentheses. */
function headline(text: string) {
  const plain = plainCheck(text).replace(/\s*\([^)]*\)/g, "")
  return /^.*?[.!?](?=\s|$)/.exec(plain)?.[0] ?? plain
}

const failing = computed(() => {
  const rows = [...checks.value.values()]
    .map(check => ({ check, failed: runs.value.filter(({ run }) => run.rubric.checks.some(item => item.id === check.id && item.outcome === "fail")) }))
    .filter(row => row.failed.length && (!section.value || row.check.section === section.value))
  return rows.sort((a, b) => b.failed.length - a.failed.length || Number(b.check.major) - Number(a.check.major) || a.check.id.localeCompare(b.check.id, undefined, { numeric: true }))
})
const showAll = ref(false)
const shownChecks = computed(() => showAll.value ? failing.value : failing.value.slice(0, 12))

function pick(key: string) {
  section.value = key
  showAll.value = false
  document.getElementById("failed-checks")?.scrollIntoView({ behavior: "smooth", block: "start" })
}
</script>

<template>
  <div>
    <section
      v-if="part === 'sections'"
      class="px-6"
    >
      <div class="relative overflow-x-auto">
        <table class="text-sm">
          <thead>
            <tr>
              <th class="sticky left-0 z-[1] bg-default" />
              <th class="slant">
                <span class="font-medium text-highlighted">Score</span>
              </th>
              <th class="slant">
                <span title="Vite Doctor's diagnostics, 10% of the score">Vite Doctor</span>
              </th>
              <th class="slant">
                <span title="Design quality a linter can't see. Not part of the score.">Vibe</span>
              </th>
              <th class="slant">
                <span>Cost</span>
              </th>
              <th class="slant">
                <span>Time</span>
              </th>
              <th class="slant">
                <span>Tokens</span>
              </th>
              <th class="w-3" />
              <th
                v-for="item in sections"
                :key="item.key"
                class="slant"
              >
                <button
                  type="button"
                  :title="`${item.title}: show its failed checks`"
                  @click="pick(item.key)"
                >
                  {{ sectionName(item.key) }}
                </button>
              </th>
              <th class="w-16" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="reference">
              <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap max-sm:min-w-36 max-sm:whitespace-normal">
                <NuxtLink
                  :to="`/projects/${project!.project}`"
                  class="font-medium text-highlighted hover:underline hover:underline-offset-4"
                >Reference app</NuxtLink>
                <span
                  v-if="projectStack(project!.project)"
                  class="ml-2 text-xs text-dimmed max-sm:ml-0 max-sm:block"
                >{{ projectStack(project!.project) }}</span>
              </th>
              <td class="px-0.5 py-2 text-center">
                <ScoreCell
                  :score="reference.score"
                  size="md"
                  label="Reference app, score"
                />
              </td>
              <td class="px-0.5 py-2 text-center">
                <ScoreCell
                  :score="reference.doctor?.score"
                  label="Reference app, Vite Doctor"
                />
              </td>
              <td class="px-0.5 py-2 text-center">
                <ScoreCell
                  :score="reference.vibe?.score"
                  label="Reference app, vibe"
                />
              </td>
              <td colspan="4" />
              <td
                v-for="item in sections"
                :key="item.key"
                class="px-0.5 py-2 text-center"
              >
                <ScoreCell
                  :score="scoreOf(reference, item.key)"
                  :label="`Reference app, ${item.title}`"
                />
              </td>
            </tr>
            <template
              v-for="agent in agents"
              :key="agent.key"
            >
              <tr>
                <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap max-sm:min-w-36 max-sm:whitespace-normal">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 text-left"
                    :aria-expanded="open.has(agent.key)"
                    @click="toggle(agent.key)"
                  >
                    <UIcon
                      name="i-lucide-chevron-right"
                      class="size-3.5 shrink-0 text-dimmed transition-transform max-sm:hidden"
                      :class="{ 'rotate-90': open.has(agent.key) }"
                    />
                    <span
                      class="size-2 shrink-0 rounded-full"
                      :style="{ background: agent.color }"
                    />
                    <span class="font-medium text-highlighted">{{ agent.name }}</span>
                  </button>
                  <span class="ml-2 text-xs text-dimmed max-sm:ml-0 max-sm:block">{{ agent.detail }}</span>
                </th>
                <td class="px-0.5 py-2 text-center">
                  <ScoreCell
                    :score="agent.score"
                    size="md"
                    :label="`${agent.name}, median score`"
                  />
                </td>
                <td class="px-0.5 py-2 text-center">
                  <ScoreCell
                    :score="agent.doctor"
                    :label="`${agent.name}, Vite Doctor`"
                  />
                </td>
                <td class="px-0.5 py-2 text-center">
                  <ScoreCell
                    :score="agent.vibe"
                    :label="`${agent.name}, vibe`"
                  />
                </td>
                <td class="num">
                  {{ agent.cost === null ? "–" : money(agent.cost) }}
                </td>
                <td class="num">
                  {{ agent.ms === null ? "–" : duration(agent.ms) }}
                </td>
                <td class="num">
                  {{ agent.tokens === null ? "–" : tokens(agent.tokens) }}
                </td>
                <td />
                <td
                  v-for="item in sections"
                  :key="item.key"
                  class="px-0.5 py-2 text-center"
                >
                  <ScoreCell
                    :score="agent.sections[item.key]"
                    :label="`${agent.name}, ${item.title}`"
                  />
                </td>
              </tr>
              <template v-if="open.has(agent.key)">
                <tr
                  v-for="run in agent.runs"
                  :key="run.id"
                >
                  <th class="sticky left-0 z-[1] bg-default py-1 pl-6 pr-5 text-left text-xs font-normal whitespace-nowrap">
                    <NuxtLink
                      :to="`/runs/${run.id}`"
                      class="text-muted hover:text-highlighted hover:underline hover:underline-offset-4"
                    >Run {{ run.n }}</NuxtLink>
                    <span
                      v-if="run.diagnostics.error"
                      class="ml-2 rounded-sm bg-(--score-3)/20 px-1 text-[11px] text-warning"
                      :title="run.diagnostics.error"
                    >time limit</span>
                    <span
                      v-else-if="!run.rubric.started"
                      class="ml-2 text-error"
                    >did not start</span>
                  </th>
                  <td class="px-0.5 py-1 text-center">
                    <ScoreCell
                      :score="Math.round(run.rubric.score * 10) / 10"
                      :label="`Run ${run.n}, score`"
                      class="h-5! text-xs!"
                    />
                  </td>
                  <td class="px-0.5 py-1 text-center">
                    <ScoreCell
                      :score="run.rubric.doctor?.score"
                      :label="`Run ${run.n}, Vite Doctor`"
                      class="h-5! text-xs!"
                    />
                  </td>
                  <td class="px-0.5 py-1 text-center">
                    <ScoreCell
                      :score="run.rubric.vibe?.score"
                      :label="`Run ${run.n}, vibe`"
                      class="h-5! text-xs!"
                    />
                  </td>
                  <td class="num">
                    {{ money(run.usage.costUsd === undefined ? Number.NaN : Number(run.usage.costUsd)) }}
                  </td>
                  <td class="num">
                    {{ duration(run.durationMs) }}
                  </td>
                  <td class="num">
                    {{ tokens(run.usage.totalTokens ?? (run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0)) }}
                  </td>
                  <td />
                  <td
                    v-for="item in sections"
                    :key="item.key"
                    class="px-0.5 py-1 text-center"
                  >
                    <NuxtLink
                      :to="`/runs/${run.id}#section-${item.key}`"
                      class="inline-flex rounded-xs hover:outline-2 hover:outline-offset-1 hover:outline-(--ui-text-highlighted)"
                    >
                      <ScoreCell
                        :score="scoreOf(run.rubric, item.key)"
                        :label="`Run ${run.n}, ${item.title}`"
                        class="h-5! text-xs!"
                      />
                    </NuxtLink>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
      <p class="mt-4 flex items-center gap-1.5 text-xs text-dimmed">
        <span class="mr-1">0 broken</span>
        <ScoreCell
          v-for="score in [1, 3, 5, 7, 9]"
          :key="score"
          :score="score"
          class="h-4! w-6! text-[10px]!"
        />
        <span class="ml-1">10 every check passes</span>
      </p>
    </section>

    <section
      v-if="part === 'checks' && checks.size"
      id="failed-checks"
      class="scroll-mt-16 px-6"
    >
      <h2 class="text-sm font-medium text-highlighted">
        Checks the runs fail
      </h2>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          class="chip"
          :aria-pressed="!section"
          @click="section = null"
        >
          All sections
        </button>
        <button
          v-if="section"
          type="button"
          class="chip"
          aria-pressed="true"
          @click="section = null"
        >
          {{ sectionTitle(section) }} ×
        </button>
        <span class="ml-1 text-muted">{{ failing.length }} checks · {{ runs.length }} runs · each square is one run</span>
      </div>
      <ul class="mt-3 text-sm">
        <li
          v-for="row in shownChecks"
          :key="row.check.id"
          class="-mx-2 rounded-md px-2 transition-colors hover:bg-elevated/50"
        >
          <details class="group">
            <summary class="grid cursor-pointer list-none grid-cols-[3rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 py-2.5 max-sm:grid-cols-[2.5rem_minmax(0,1fr)] [&::-webkit-details-marker]:hidden">
              <span class="font-mono text-xs text-dimmed">{{ row.check.id }}</span>
              <span class="min-w-0 text-default group-open:text-highlighted">
                <span
                  v-if="row.check.major"
                  class="mr-1.5 rounded-sm bg-error/10 px-1 text-[11px] font-medium text-error"
                >major</span>
                <InlineCode :text="headline(row.check.text)" />
                <span class="ml-1.5 text-xs text-dimmed">{{ sectionName(row.check.section) }}</span>
              </span>
              <span class="flex items-center gap-[3px] max-sm:col-start-2">
                <span
                  v-for="{ run, agent } in runs"
                  :key="run.id"
                  class="size-3 rounded-[2px]"
                  :class="row.failed.some(item => item.run.id === run.id) ? 'bg-(--score-1)' : 'bg-(--ui-border)'"
                  :title="`${agent.name} run ${run.n}: ${row.failed.some(item => item.run.id === run.id) ? 'failed' : 'passed'}`"
                />
                <span class="ml-1.5 min-w-8 text-right text-xs font-medium tabular-nums text-highlighted">{{ row.failed.length }}/{{ runs.length }}</span>
              </span>
            </summary>
            <div class="pb-4 pl-[3.75rem] max-sm:pl-[3.25rem]">
              <p class="max-w-prose text-[13px] leading-6 text-muted">
                <InlineCode :text="plainCheck(row.check.text)" />
              </p>
              <p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span class="text-dimmed">Failed in</span>
                <NuxtLink
                  v-for="{ run, agent } in row.failed"
                  :key="run.id"
                  :to="`/runs/${run.id}#check-${row.check.id}`"
                  class="link"
                >{{ agent.name }} run {{ run.n }}</NuxtLink>
              </p>
            </div>
          </details>
        </li>
      </ul>
      <button
        v-if="failing.length > 12"
        type="button"
        class="mt-3 text-sm text-muted underline underline-offset-4 hover:text-highlighted"
        @click="showAll = !showAll"
      >
        {{ showAll ? "Show fewer" : `Show all ${failing.length}` }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.slant {
  height: 9.5rem;
  min-width: 2rem;
  padding: 0;
  vertical-align: bottom;
  font-weight: 400;
}

.slant > * {
  display: block;
  width: 1.75rem;
  transform: translate(0.75rem, -0.375rem) rotate(-50deg);
  transform-origin: left bottom;
  white-space: nowrap;
  text-align: left;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}

.slant > button:hover {
  color: var(--ui-text-highlighted);
}

.num {
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
  text-align: right;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-muted);
}

.chip {
  height: 1.625rem;
  padding: 0 0.625rem;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
}

.chip[aria-pressed="true"] {
  border-color: var(--ui-border-accented);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-highlighted);
}
</style>
