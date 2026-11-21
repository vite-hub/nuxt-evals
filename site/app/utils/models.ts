import type { RunSummary } from "#shared/report"
import { harnessLabel, modelLabel, setupLabel } from "#shared/labels"
import type { Agent } from "./agents"
import { agentsOf } from "./agents"

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

/** A column of the landing matrix. */
export interface Block { projects: string[] }

/** A side's agents in a block. */
export const agentsIn = (side: Record<string, Agent>, block: Block) => block.projects.flatMap(project => side[project] ? [side[project]] : [])

/** A side's score in a block: the mean of its projects' medians. */
export const blockScore = (side: Record<string, Agent>, block: Block) => mean(agentsIn(side, block).map(agent => agent.score))
