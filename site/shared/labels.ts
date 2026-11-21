import type { Harness, Setup } from "./report"

const harnesses: Record<Harness, string> = { "codex": "Codex", "claude-code": "Claude Code" }

export function harnessLabel(harness: string): string {
  return harnesses[harness as Harness] ?? harness
}

const setupNames: Record<Setup, string> = { A: "bare", B: "Nuxt MCP + Nuxt skill", C: "Nuxt MCP + nuxt-skills", V: "Vue skills", CS: "Nuxt MCP + nuxt-skills, told to use them", VS: "Vue skills, told to use them" }

/** `Vue skills` for setup V. Setup A, the bare agent, is the default, so names leave it out. */
export function setupLabel(setup: string): string {
  return setupNames[setup as Setup] ?? `setup ${setup}`
}

/** `gpt-6-luna` → `GPT-6 Luna`, `claude-opus-5-5` → `Opus 5.5`. */
export function modelLabel(model: string): string {
  const claude = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(model)
  if (claude) return `${claude[1]![0]!.toUpperCase()}${claude[1]!.slice(1)} ${claude[2]}.${claude[3]}`
  const gpt = /^gpt-([\d.]+)-([a-z]+)$/.exec(model)
  if (gpt) return `GPT-${gpt[1]} ${gpt[2]![0]!.toUpperCase()}${gpt[2]!.slice(1)}`
  return model
}

const projects: Record<string, string> = {
  "meetups": "Meetups",
  "meal-planner": "Meal planner",
}

export function projectLabel(project: string): string {
  return projects[project] ?? project.split("-").map(word => word[0]!.toUpperCase() + word.slice(1)).join(" ")
}

/** What the project's prompt asks the agent to build with. */
const stacks: Record<string, string> = { "meetups": "Nuxt 5 + ViteHub", "meal-planner": "Vue only" }

export function projectStack(project: string): string | undefined {
  return stacks[project]
}

/** What a project's app does, in one sentence, for the Methodology page. */
const summaries: Record<string, string> = {
  "meetups": "A small meetup.com for tech events: sign-up with passkeys, cover photos, RSVPs with live seats and a reminder email the day before.",
  "meal-planner": "A meal planner over 20,289 recipes: households with diets and allergies, a pantry, a shopping list, share links, English and Spanish, and offline use. No backend.",
}

export function projectSummary(project: string): string | undefined {
  return summaries[project]
}
