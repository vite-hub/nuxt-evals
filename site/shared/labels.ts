import type { Harness } from "./report"

const harnesses: Record<Harness, string> = { "codex": "Codex", "claude-code": "Claude Code" }

export function harnessLabel(harness: string): string {
  return harnesses[harness as Harness] ?? harness
}

/** `gpt-6-luna` → `GPT-6 Luna`, `claude-opus-5-5` → `Opus 5.5`. */
export function modelLabel(model: string): string {
  const claude = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(model)
  if (claude) return `${claude[1]![0]!.toUpperCase()}${claude[1]!.slice(1)} ${claude[2]}.${claude[3]}`
  const gpt = /^gpt-([\d.]+)-([a-z]+)$/.exec(model)
  if (gpt) return `GPT-${gpt[1]} ${gpt[2]![0]!.toUpperCase()}${gpt[2]!.slice(1)}`
  return model
}

const projects: Record<string, string> = { "meetups": "Meetups v1", "meetups-v2": "Meetups v2" }

export function projectLabel(project: string): string {
  return projects[project] ?? project.split("-").map(word => word[0]!.toUpperCase() + word.slice(1)).join(" ")
}
