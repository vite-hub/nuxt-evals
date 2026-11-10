import type { RunSummary } from "#shared/report"
import type { RubricGrade } from "#shared/rubric"
import { harnessLabel, modelLabel } from "#shared/labels"
import { median } from "./rubric"

export type GradedRun = RunSummary & { rubric: RubricGrade }

/** One agent: a harness, model, effort and setup, with its runs numbered by start time. */
export interface Agent {
  key: string
  /** `Opus 5.5 high` */
  name: string
  /** `Claude Code · 3 runs` */
  detail: string
  /** A CSS color, one per agent so two models on one harness don't share a tone. */
  color: string
  runs: (GradedRun & { n: number })[]
  /** Median rubric score, 1 to 5. */
  score: number
  cost: number | null
  ms: number | null
  tokens: number | null
  sections: Record<string, number | null>
}

export const runCost = (run: RunSummary) => run.usage.costUsd === undefined || run.usage.costUsd === null ? Number.NaN : Number(run.usage.costUsd)
export const runTokens = (run: RunSummary) => run.usage.totalTokens ?? (run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0)

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
      name: `${modelLabel(first.model)} ${first.reasoning}`,
      detail: `${harnessLabel(first.harness)} · ${sorted.length === 1 ? "1 run" : `${sorted.length} runs`}`,
      color: "",
      runs: sorted,
      score: median(sorted.map(run => run.rubric.score)) ?? 0,
      cost: finite(median(sorted.map(runCost))),
      ms: finite(median(sorted.map(run => run.durationMs))),
      tokens: finite(median(sorted.map(runTokens))),
      sections: Object.fromEntries(keys.map(section => [section, median(sorted.map(run => run.rubric.sections.find(item => item.key === section)?.score ?? Number.NaN))])),
    }
  }).sort((a, b) => b.score - a.score).map((agent, index) => ({ ...agent, color: `var(--agent-${index % 6})` }))
}
