import type { RunSummary } from "#shared/report"
import type { RubricGrade, RubricSection } from "#shared/rubric"
import { headlineParts } from "#shared/rubric"
import { harnessLabel, modelLabel, setupLabel } from "#shared/labels"
import type { Agent } from "./agents"
import { agentsOf } from "./agents"
import { median } from "./rubric"

/**
 * The landing compares each model without skills and with them. A model shows one effort, the highest it has runs
 * at, so the same model never takes two rows (Maxi, 2026-11-21: drop high, keep xhigh).
 */
const efforts = ["minimal", "low", "medium", "high", "xhigh", "max"]
export const modelKey = (run: Pick<RunSummary, "harness" | "model">) => `${run.harness}|${run.model}`

export function topEfforts(runs: RunSummary[]): Map<string, string> {
  const top = new Map<string, string>()
  for (const run of runs) {
    const key = modelKey(run)
    const current = top.get(key)
    if (current === undefined || efforts.indexOf(run.reasoning) > efforts.indexOf(current)) top.set(key, run.reasoning)
  }
  return top
}

/** The skills side of a cell, when a model ran several setups with skills: told to use them first, then the Nuxt and Vue sets. */
const skillSetups = ["CS", "VS", "C", "V", "B"]

export interface ModelRow {
  key: string
  /** `Sol 6.1 xhigh` */
  name: string
  harness: string
  color: string
  /** Per project: the bare agent (setup A) and the agent with skills. */
  bare: Record<string, Agent>
  skills: Record<string, Agent>
}

/** One row per model at its one effort, in the order of the agent rows so colors match the project pages. */
export function modelRows(runs: RunSummary[], projects: string[]): ModelRow[] {
  const rows = new Map<string, ModelRow>()
  for (const project of projects) {
    const agents = agentsOf(runs.filter(run => run.project === project))
    for (const agent of agents) {
      const first = agent.runs[0]!
      const key = modelKey(first)
      const row = rows.get(key) ?? { key, name: `${modelLabel(first.model)} ${first.reasoning}`, harness: harnessLabel(first.harness), color: "", bare: {}, skills: {} }
      if (first.setup === "A") row.bare[project] = agent
      else {
        const current = row.skills[project]
        if (!current || skillSetups.indexOf(first.setup) < skillSetups.indexOf(current.runs[0]!.setup)) row.skills[project] = agent
      }
      rows.set(key, row)
    }
  }
  return [...rows.values()].map((row, index) => ({ ...row, color: `var(--agent-${index % 6})` }))
}

/** `Nuxt MCP + nuxt-skills`: the setup behind a skills cell. */
export const skillsSetupOf = (agent: Agent) => setupLabel(agent.runs[0]!.setup)

export const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

/** What the matrix needs of a project: its rubric's sections, to split a grade into its parts, and the reference's grade. */
export interface ProjectRubric {
  sections: RubricSection[]
  weights?: Record<string, number>
  reference: RubricGrade | null
}

/**
 * A matrix column inside a project: the headline, then what it is made of. The general and ViteHub sections and Vite
 * Doctor weigh into the headline; vibe stands on its own.
 */
export type ScorePart = "score" | "general" | "vitehub" | "doctor" | "vibe"

/** One grade's value for a component, 0 to 10. */
export function gradeComponent(grade: RubricGrade, component: ScorePart, rubric: ProjectRubric | undefined): number | null {
  if (component === "score") return grade.score
  if (component === "doctor") return grade.doctor?.score ?? null
  if (component === "vibe") return grade.vibe?.score ?? null
  if (!rubric) return null
  if (!grade.started) return 0
  return headlineParts(rubric.sections, grade.sections, rubric.weights)[component]
}

/** An agent's median for a component over its runs. */
export const agentComponent = (agent: Agent, component: ScorePart, rubric: ProjectRubric | undefined) =>
  median(agent.runs.map(run => gradeComponent(run.rubric, component, rubric) ?? Number.NaN))
