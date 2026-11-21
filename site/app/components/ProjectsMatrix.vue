<script setup lang="ts">
import { projectLabel, projectStack } from "#shared/labels"
import { skillsOpened } from "../utils/agents"
import type { ModelRow } from "../utils/models"
import { agentsIn, blockScore, mean, skillsSetupOf } from "../utils/models"
import { scoreText } from "../utils/rubric"

/**
 * Every eval side by side: one row per model, one column per eval, and in each cell the model's median without skills
 * and with them. A build project is a column of its own. The fix cases share one column, the mean of each case's
 * median. A column's name, or a cell, opens that eval's grid.
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
  rows: ModelRow[]
  blocks: MatrixBlock[]
  references: Record<string, { score: number } | null>
}>()


function sideLabel(row: ModelRow, block: MatrixBlock, side: "bare" | "skills") {
  const agents = agentsIn(row[side], block)
  const what = side === "bare" ? "without skills" : `with skills${agents[0] ? ` (${skillsSetupOf(agents[0])})` : ""}`
  if (!agents.length) return `${row.name}, ${block.label}, ${what}: not run yet`
  const score = scoreText(blockScore(row[side], block))
  if (block.kind === "fix") return `${row.name}, ${block.label}, ${what}: ${score}, mean of ${agents.length} ${agents.length === 1 ? "case" : "cases"}`
  return `${row.name}, ${block.label}, ${what}: ${score}, median of ${agents[0]!.runs.map(run => scoreText(run.rubric.score)).join(", ")}`
}

const referenceScore = (block: MatrixBlock) => mean(block.projects.flatMap(project => props.references[project] ? [props.references[project]!.score] : []))

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

/** A block's grid: its project's, or for the fix block the first case's (the sidebar picks the others). */
const blockLink = (block: MatrixBlock) => ({ query: { ...route.query, task: block.projects[0] } })
const blockChip = (block: MatrixBlock) => block.kind === "fix" ? `${block.projects.length} cases` : projectStack(block.projects[0]!)
</script>

<template>
  <section class="px-6">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th class="sticky left-0 z-[1] bg-default" />
            <th
              v-for="block in blocks"
              :key="block.id"
              class="px-2 pb-2 text-center font-normal"
            >
              <NuxtLink
                :to="blockLink(block)"
                class="group inline-flex flex-col items-center gap-1 text-[13px]"
              >
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <StackLogos :project="block.projects[0]!" />
                  <span class="font-medium text-highlighted group-hover:underline group-hover:underline-offset-4">{{ block.label }}</span>
                </span>
                <span
                  v-if="blockChip(block)"
                  class="text-[11px] leading-4 text-dimmed"
                >{{ blockChip(block) }}</span>
              </NuxtLink>
            </th>
          </tr>
          <tr class="text-[11px] leading-4 text-dimmed">
            <th class="sticky left-0 z-[1] bg-default pb-1.5 pr-5 text-left font-normal">
              Skills
            </th>
            <th
              v-for="block in blocks"
              :key="block.id"
              class="px-2 pb-1.5 font-normal"
            >
              <span class="mx-auto flex w-[5.75rem] justify-between px-1">
                <span>without</span>
                <span>with</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-default">
            <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap">
              <span class="font-medium text-highlighted">Reference app</span>
            </th>
            <td
              v-for="block in blocks"
              :key="block.id"
              class="px-2 py-2 text-center"
            >
              <NuxtLink :to="`/projects/${block.projects[0]}`">
                <ScoreCell
                  :score="referenceScore(block)"
                  size="md"
                  class="w-[5.75rem]"
                  :label="`${block.label} reference`"
                />
              </NuxtLink>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.key"
          >
            <th class="sticky left-0 z-[1] bg-default py-2 pr-5 text-left font-normal whitespace-nowrap max-sm:min-w-36 max-sm:whitespace-normal">
              <span class="inline-flex items-center gap-2">
                <span
                  class="size-2 shrink-0 rounded-full"
                  :style="{ background: row.color }"
                />
                <span class="font-medium text-highlighted">{{ row.name }}</span>
              </span>
              <span class="ml-2 text-xs text-dimmed max-sm:ml-0 max-sm:block">{{ row.harness }}</span>
              <span
                v-if="skillUse(row)"
                class="ml-2 rounded-sm bg-elevated px-1 text-[11px] text-muted"
                :title="skillUse(row)!.title"
              >skills read in {{ skillUse(row)!.opened }} of {{ skillUse(row)!.runs }}</span>
            </th>
            <td
              v-for="block in blocks"
              :key="block.id"
              class="px-2 py-2 text-center"
            >
              <NuxtLink
                :to="blockLink(block)"
                class="inline-flex rounded-xs hover:outline-2 hover:outline-offset-2 hover:outline-(--ui-text-highlighted)"
              >
                <SplitCell
                  :bare="blockScore(row.bare, block)"
                  :skills="blockScore(row.skills, block)"
                  :bare-label="sideLabel(row, block, 'bare')"
                  :skills-label="sideLabel(row, block, 'skills')"
                />
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-4 flex items-center gap-1.5 text-xs text-dimmed">
      0
      <ScoreCell
        v-for="score in [1, 3, 5, 7, 9]"
        :key="score"
        :score="score"
        class="h-4! w-6! text-[10px]!"
      />
      100
    </p>
  </section>
</template>
