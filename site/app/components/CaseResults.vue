<script setup lang="ts">
import { computed } from "vue"
import type { RunSummary } from "#shared/report"
import { projectKind, projectLabel, projectSummary } from "#shared/labels"
import { type Agent, agentsOf } from "../utils/agents"
import { duration, money } from "../utils/format"

/**
 * Fix and scan projects, one row each: the agent got the Meetups app with planted bugs instead of an empty folder. A
 * fix row says how many runs made the reported problem go away (the gate) next to the median score; a run that
 * didn't scores 0.
 */
const route = useRoute()

const props = defineProps<{
  runs: RunSummary[]
  projects: string[]
  references: Record<string, { score: number, doctor: number | null, vibe: number | null } | null>
  colors: Map<string, string>
}>()

const groups = computed(() => [
  { kind: "fix", title: "Fix a reported bug", note: "The agent gets the Meetups app with one planted bug and a user's report of it. A script checks the problem is gone; a run that fails it scores 0. The judge then grades the root cause and how smart the fix is against the fixes we know." },
  { kind: "scan", title: "Find hidden bugs", note: "The agent reviews the Meetups app without running it and lists the bugs it finds. Planted bugs it finds score; correct code it calls a bug costs." },
].map(group => ({ ...group, projects: props.projects.filter(project => projectKind(project) === group.kind) })).filter(group => group.projects.length))

/** Every agent that ran a fix or scan project, best overall first; each keeps its color from the matrix above. */
const agents = computed(() => agentsOf(props.runs).map(agent => ({ key: agent.key, name: agent.name, color: props.colors.get(agent.key) ?? agent.color })))
const byProject = computed(() => Object.fromEntries(props.projects.map(project => [project, new Map(agentsOf(props.runs.filter(run => run.project === project)).map(agent => [agent.key, agent]))])) as Record<string, Map<string, Agent>>)

/** Runs whose gate held: the reported problem is gone (fix) or findings.json was there (scan). */
const passed = (agent: Agent) => agent.runs.filter(run => run.rubric.started && !run.rubric.gateFailed?.length).length
</script>

<template>
  <section class="px-6">
    <div
      v-for="group in groups"
      :key="group.kind"
      class="pt-12"
    >
      <h2 class="text-sm font-medium text-highlighted">
        {{ group.title }}
      </h2>
      <p class="mt-1 max-w-prose text-[13px] leading-5 text-muted">
        {{ group.note }}
      </p>
      <div class="relative mt-4 overflow-x-auto">
        <table class="text-sm">
          <thead>
            <tr>
              <th class="sticky left-0 z-[1] bg-default" />
              <th class="px-1 pb-1 text-[11px] font-normal text-muted">
                Reference
              </th>
              <template
                v-for="agent in agents"
                :key="agent.key"
              >
                <th class="w-4" />
                <th
                  colspan="5"
                  class="pb-1 pl-1 text-left text-[13px] font-normal whitespace-nowrap"
                >
                  <span
                    class="mr-1.5 inline-block size-2 rounded-full"
                    :style="{ background: agent.color }"
                  />
                  <span class="font-medium text-highlighted">{{ agent.name }}</span>
                </th>
              </template>
            </tr>
            <tr>
              <th class="sticky left-0 z-[1] bg-default" />
              <th />
              <template
                v-for="agent in agents"
                :key="agent.key"
              >
                <th />
                <th class="px-0.5 pb-1.5 text-[11px] font-normal text-muted">
                  Score
                </th>
                <th
                  class="px-1 pb-1.5 text-[11px] font-normal whitespace-nowrap text-muted"
                  :title="group.kind === 'fix' ? 'Runs that made the reported problem go away' : 'Runs that wrote their findings'"
                >
                  {{ group.kind === "fix" ? "Fixed" : "Wrote findings" }}
                </th>
                <th
                  class="px-0.5 pb-1.5 text-[11px] font-normal text-muted"
                  title="How smart the change is. Not part of the score."
                >
                  Vibe
                </th>
                <th class="pr-2 pb-1.5 text-right text-[11px] font-normal text-muted">
                  Cost
                </th>
                <th class="pr-2 pb-1.5 text-right text-[11px] font-normal text-muted">
                  Time
                </th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="project in group.projects"
              :key="project"
            >
              <th class="sticky left-0 z-[1] max-w-80 bg-default py-2 pr-5 text-left font-normal">
                <NuxtLink
                  :to="{ query: { ...route.query, task: project } }"
                  class="font-medium text-highlighted hover:underline hover:underline-offset-4"
                  :title="projectSummary(project)"
                >
                  {{ projectLabel(project) }}
                </NuxtLink>
              </th>
              <td class="px-1 py-2 text-center">
                <NuxtLink :to="`/projects/${project}`">
                  <ScoreCell
                    :score="references[project]?.score"
                    :label="`${projectLabel(project)} reference, score`"
                  />
                </NuxtLink>
              </td>
              <template
                v-for="agent in agents"
                :key="agent.key"
              >
                <td />
                <template v-if="byProject[project]?.get(agent.key)">
                  <td class="px-0.5 py-2 text-center">
                    <ScoreCell
                      :score="byProject[project]!.get(agent.key)!.score"
                      size="md"
                      :label="`${agent.name}, ${projectLabel(project)}, median score`"
                    />
                  </td>
                  <td class="px-1 py-2 text-center text-xs whitespace-nowrap tabular-nums text-muted">
                    {{ passed(byProject[project]!.get(agent.key)!) }} of {{ byProject[project]!.get(agent.key)!.runs.length }}
                  </td>
                  <td class="px-0.5 py-2 text-center">
                    <ScoreCell
                      :score="byProject[project]!.get(agent.key)!.vibe"
                      :label="`${agent.name}, ${projectLabel(project)}, vibe`"
                    />
                  </td>
                  <td class="num">
                    {{ byProject[project]!.get(agent.key)!.cost == null ? "–" : money(byProject[project]!.get(agent.key)!.cost!) }}
                  </td>
                  <td class="num">
                    {{ byProject[project]!.get(agent.key)!.ms == null ? "–" : duration(byProject[project]!.get(agent.key)!.ms!) }}
                  </td>
                </template>
                <td
                  v-else
                  colspan="5"
                  class="text-center text-xs text-dimmed"
                >
                  –
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p class="mt-4 text-xs text-dimmed">
      Medians of each agent's runs. Open a case for its runs, its checks and the fixes we know.
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
