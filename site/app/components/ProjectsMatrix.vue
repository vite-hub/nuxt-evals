<script setup lang="ts">
import { computed } from "vue"
import { projectLabel, projectStack } from "#shared/labels"
import { headlineWeights } from "#shared/rubric"
import type { Agent } from "../utils/agents"
import { skillsOpened } from "../utils/agents"
import type { ScorePart, ModelRow, ProjectRubric } from "../utils/models"
import { agentComponent, gradeComponent, mean, skillsSetupOf } from "../utils/models"
import { scoreText } from "../utils/rubric"

/**
 * Every eval side by side: one row per model, and in each cell the model's median without skills and with them. A
 * Total column comes first, then each project with its score and what the score is made of. A project's name, or a
 * cell, opens that project's grid.
 */
const route = useRoute()

const props = defineProps<{
  rows: ModelRow[]
  projects: string[]
  rubrics: Record<string, ProjectRubric>
}>()

interface Column {
  component: ScorePart
  label: string
  title: string
}

const percent = (share: number) => `${Math.round(share * 100)}%`

/** A project's columns. The general sections are "Rubric" when the project has no ViteHub sections. */
function columnsOf(project: string): Column[] {
  const rubric = props.rubrics[project]
  const vitehub = !!rubric?.sections.some(section => section.part === "vitehub")
  const total = headlineWeights.general + headlineWeights.doctor + (vitehub ? headlineWeights.vitehub : 0)
  return [
    { component: "score", label: "Score", title: "The score, 0 to 100" },
    { component: "general", label: vitehub ? "General" : "Rubric", title: `${percent(headlineWeights.general / total)} of the score: the mean of the rubric's ${vitehub ? "general " : ""}sections` },
    ...vitehub ? [{ component: "vitehub" as const, label: "ViteHub", title: `${percent(headlineWeights.vitehub / total)} of the score: the mean of the rubric's ViteHub sections` }] : [],
    { component: "doctor", label: "Doctor", title: `${percent(headlineWeights.doctor / total)} of the score: Vite Doctor's diagnostics against the reference app's` },
    { component: "vibe", label: "Vibe", title: "Design quality a linter can't see. Not part of the score" },
  ]
}

const groups = computed(() => props.projects.map(project => ({ project, label: projectLabel(project), stack: projectStack(project), columns: columnsOf(project) })))

const sideName = (row: ModelRow, project: string, side: "bare" | "skills") => {
  const agent = row[side][project]
  return side === "bare" ? "without skills" : `with skills${agent ? ` (${skillsSetupOf(agent)})` : ""}`
}

const cellValue = (agent: Agent | undefined, project: string, column: Column) => agent ? agentComponent(agent, column.component, props.rubrics[project]) : null

function cellLabel(row: ModelRow, project: string, column: Column, side: "bare" | "skills") {
  const agent = row[side][project]
  const what = `${row.name}, ${projectLabel(project)} ${column.label.toLowerCase()}, ${sideName(row, project, side)}`
  if (!agent) return `${what}: not run yet`
  const runs = agent.runs.map(run => scoreText(gradeComponent(run.rubric, column.component, props.rubrics[project]))).join(", ")
  return `${what}: ${scoreText(cellValue(agent, project, column))}, median of ${runs}`
}

/** A side's mean score over every project, only when it ran all of them. */
function totalOf(row: ModelRow, side: "bare" | "skills") {
  const agents = props.projects.flatMap(project => row[side][project] ? [row[side][project]] : [])
  return agents.length === props.projects.length ? mean(agents.map(agent => agent.score)) : null
}

function totalLabel(row: ModelRow, side: "bare" | "skills") {
  const ran = props.projects.filter(project => row[side][project]).length
  const what = `${row.name}, total ${side === "bare" ? "without" : "with"} skills`
  return ran === props.projects.length ? `${what}: ${scoreText(totalOf(row, side))}, the mean of the projects' scores` : `${what}: ran ${ran} of ${props.projects.length} projects`
}

const referenceValue = (project: string, column: Column) => {
  const reference = props.rubrics[project]?.reference
  return reference ? gradeComponent(reference, column.component, props.rubrics[project]) : null
}
const referenceTotal = computed(() => {
  const scores = props.projects.map(project => props.rubrics[project]?.reference?.score ?? null)
  return scores.every(score => score !== null) ? mean(scores as number[]) : null
})

/** How many runs with skills opened one of their skills, with each run's skills for the tooltip. */
function skillUse(row: ModelRow) {
  const runs = Object.entries(row.skills).flatMap(([project, agent]) => agent.runs.map(run => ({ project, run, skills: skillsOpened(run) })))
  const known = runs.filter(entry => entry.skills !== null)
  if (!known.length) return null
  return {
    opened: known.filter(entry => entry.skills!.length).length,
    runs: known.length,
    title: known.map(entry => `${projectLabel(entry.project)} run ${entry.run.n}: ${entry.skills!.join(", ") || "no skill"}`).join("\n"),
  }
}

const projectLink = (project: string) => ({ query: { ...route.query, task: project } })
/** The first column of a project gets the gap that sets it apart from the one before. */
const cellPad = (index: number) => index === 0 ? "pl-4 pr-0.5" : "px-0.5"
</script>

<template>
  <section class="px-6">
    <div class="overflow-x-auto">
      <table class="text-sm">
        <thead>
          <tr>
            <th class="sticky left-0 z-[1] bg-default" />
            <th
              rowspan="2"
              class="pr-0.5 pb-2 align-bottom text-center text-[13px] font-medium text-highlighted"
            >
              Total
            </th>
            <th
              v-for="group in groups"
              :key="group.project"
              :colspan="group.columns.length"
              class="pb-1.5 pl-4 text-center font-normal"
            >
              <NuxtLink
                :to="projectLink(group.project)"
                class="group inline-flex flex-col items-center gap-0.5 text-[13px]"
              >
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <StackLogos :project="group.project" />
                  <span class="font-medium text-highlighted group-hover:underline group-hover:underline-offset-4">{{ group.label }}</span>
                </span>
                <span
                  v-if="group.stack"
                  class="text-[11px] leading-4 text-dimmed"
                >{{ group.stack }}</span>
              </NuxtLink>
            </th>
          </tr>
          <tr class="text-[11px] leading-4 text-dimmed">
            <th class="sticky left-0 z-[1] bg-default" />
            <template
              v-for="group in groups"
              :key="group.project"
            >
              <th
                v-for="(column, index) in group.columns"
                :key="column.component"
                class="pb-2 font-normal"
                :class="[cellPad(index), column.component === 'score' && 'text-muted']"
                :title="column.title"
              >
                {{ column.label }}
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-default">
            <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap">
              <span class="font-medium text-highlighted">Reference app</span>
            </th>
            <td class="py-2 pr-0.5 text-center">
              <ScoreCell
                :score="referenceTotal"
                size="md"
                class="h-8! w-[5.75rem]"
                label="Reference apps, total"
              />
            </td>
            <template
              v-for="group in groups"
              :key="group.project"
            >
              <td
                v-for="(column, index) in group.columns"
                :key="column.component"
                class="py-2 text-center"
                :class="cellPad(index)"
              >
                <NuxtLink :to="`/projects/${group.project}`">
                  <ScoreCell
                    :score="referenceValue(group.project, column)"
                    size="md"
                    :class="column.component === 'score' ? 'h-8! w-[5.75rem]' : 'w-16 text-[13px]!'"
                    :label="`${group.label} reference, ${column.label.toLowerCase()}`"
                  />
                </NuxtLink>
              </td>
            </template>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.key"
          >
            <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap">
              <span class="flex items-center gap-2">
                <span
                  class="size-2 shrink-0 rounded-full"
                  :style="{ background: row.color }"
                />
                <span class="font-medium text-highlighted">{{ row.name }}</span>
              </span>
              <span class="mt-0.5 flex items-center gap-2 pl-4 text-xs text-dimmed">
                {{ row.harness }}
                <span
                  v-if="skillUse(row)"
                  class="rounded-sm bg-elevated px-1 text-[11px] text-muted"
                  :title="skillUse(row)!.title"
                >skills read in {{ skillUse(row)!.opened }} of {{ skillUse(row)!.runs }}</span>
              </span>
            </th>
            <td class="py-2 pr-0.5 text-center">
              <SplitCell
                :bare="totalOf(row, 'bare')"
                :skills="totalOf(row, 'skills')"
                :bare-label="totalLabel(row, 'bare')"
                :skills-label="totalLabel(row, 'skills')"
              />
            </td>
            <template
              v-for="group in groups"
              :key="group.project"
            >
              <td
                v-for="(column, index) in group.columns"
                :key="column.component"
                class="py-2 text-center"
                :class="cellPad(index)"
              >
                <NuxtLink
                  :to="projectLink(group.project)"
                  class="inline-flex rounded-xs hover:outline-2 hover:outline-offset-2 hover:outline-(--ui-text-highlighted)"
                >
                  <SplitCell
                    :size="column.component === 'score' ? 'md' : 'sm'"
                    :bare="cellValue(row.bare[group.project], group.project, column)"
                    :skills="cellValue(row.skills[group.project], group.project, column)"
                    :bare-label="cellLabel(row, group.project, column, 'bare')"
                    :skills-label="cellLabel(row, group.project, column, 'skills')"
                  />
                </NuxtLink>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-dimmed">
      <span class="flex items-center gap-2">
        <SplitCell
          class="h-5! w-28! text-[11px]! font-normal!"
          :bare="null"
          :skills="null"
          bare-label="Left half: without skills"
          skills-label="Right half: with skills"
        >
          <template #bare>
            <span class="text-muted">without</span>
          </template>
          <template #skills>
            <span class="text-muted">with</span>
          </template>
        </SplitCell>
        skills
      </span>
      <span class="flex items-center gap-1.5">
        0
        <ScoreCell
          v-for="score in [1, 3, 5, 7, 9]"
          :key="score"
          :score="score"
          class="h-4! w-6! text-[10px]!"
        />
        100
      </span>
    </div>
  </section>
</template>
