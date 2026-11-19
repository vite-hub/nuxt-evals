import type { RunSummary } from "#shared/report"
import type { RubricGrade } from "#shared/rubric"
import { harnessLabel, modelLabel, setupLabel } from "#shared/labels"
import { median } from "./rubric"

export type GradedRun = RunSummary & { rubric: RubricGrade }

/** One agent: a harness, model, effort and setup, with its runs numbered by start time. */
export interface Agent {
  key: string
  /** `Opus 5.5 high`, or `Sol 6.1 xhigh · Vue skills` outside setup A */
  name: string
  /** `Claude Code · 3 runs` */
  detail: string
  /** A CSS color, one per agent so two models on one harness don't share a tone. */
  color: string
  runs: (GradedRun & { n: number })[]
  /** Median headline score, 0 to 10. */
  score: number
  /** Median Vite Doctor score, 0 to 10, or null when Doctor scored none of the runs. */
  doctor: number | null
  /** Median vibe score, 0 to 10, or null when no run has one. */
  vibe: number | null
  cost: number | null
  ms: number | null
  tokens: number | null
  sections: Record<string, number | null>
}

export const runCost = (run: RunSummary) => run.usage.costUsd === undefined || run.usage.costUsd === null ? Number.NaN : Number(run.usage.costUsd)
export const runTokens = (run: RunSummary) => run.usage.totalTokens ?? (run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0)

/**
 * The setup's skills a run opened, by folder, from the audit. Null in setup A, which offers none, and for older runs
 * whose audit didn't record the files.
 */
export function skillsOpened(run: RunSummary): string[] | null {
  const files = run.diagnostics.audit?.skillFiles
  if (run.setup === "A" || !files) return null
  return [...new Set(files.map(file => file.split("/")[0]!))]
}

const finite = (value: number | null) => value !== null && Number.isFinite(value) ? value : null

/** Graded runs grouped into agents, best median score first. */
export function agentsOf(runs: RunSummary[]): Agent[] {
  const map = new Map<string, GradedRun[]>()
  for (const run of runs) {
    if (!run.rubric) continue
    const key = [run.harness, run.model, run.reasoning, run.setup].join("|")
    map.set(key, [...(map.get(key) ?? []), run as GradedRun])
  }
  return [...map.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((run, index) => ({ ...run, n: index + 1 }))
    const first = sorted[0]!
    const keys = first.rubric.sections.map(section => section.key)
    return {
      key,
      name: `${modelLabel(first.model)} ${first.reasoning}${first.setup === "A" ? "" : ` · ${setupLabel(first.setup)}`}`,
      detail: `${harnessLabel(first.harness)} · ${sorted.length === 1 ? "1 run" : `${sorted.length} runs`}`,
      color: "",
      runs: sorted,
      score: median(sorted.map(run => run.rubric.score)) ?? 0,
      doctor: median(sorted.map(run => run.rubric.doctor?.score ?? Number.NaN)),
      vibe: median(sorted.map(run => run.rubric.vibe?.score ?? Number.NaN)),
      cost: finite(median(sorted.map(runCost))),
      ms: finite(median(sorted.map(run => run.durationMs))),
      tokens: finite(median(sorted.map(runTokens))),
      sections: Object.fromEntries(keys.map(section => [section, median(sorted.map(run => run.rubric.sections.find(item => item.key === section)?.score ?? Number.NaN))])),
    }
  }).sort((a, b) => b.score - a.score).map((agent, index) => ({ ...agent, color: `var(--agent-${index % 6})` }))
}

/** One agent across projects, with its results in each project it ran. */
export interface AgentRow {
  key: string
  /** `Opus 5.5 high`, or `Sol 6.1 xhigh · Vue skills` outside setup A */
  name: string
  /** `Claude Code` */
  harness: string
  color: string
  byProject: Record<string, Agent>
}

/**
 * One row per agent over every project: the first project's agents in score order, then agents that only ran a later
 * one. An agent keeps its color on every project, so the overview and a project's grid agree.
 */
export function agentRows(runs: RunSummary[], projects: string[]): AgentRow[] {
  const rows = new Map<string, AgentRow>()
  for (const project of projects) {
    for (const agent of agentsOf(runs.filter(run => run.project === project))) {
      const row = rows.get(agent.key) ?? { key: agent.key, name: agent.name, harness: harnessLabel(agent.runs[0]!.harness), color: "", byProject: {} }
      row.byProject[project] = agent
      rows.set(agent.key, row)
    }
  }
  return [...rows.values()].map((row, index) => ({ ...row, color: `var(--agent-${index % 6})` }))
}

/** A run that doesn't build or start scores 0. */
export const brokenRuns = (agent: Agent) => agent.runs.filter(run => run.rubric.score === 0).length
