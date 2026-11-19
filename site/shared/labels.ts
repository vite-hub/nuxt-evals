import type { Harness, Setup } from "./report"

const harnesses: Record<Harness, string> = { "codex": "Codex", "claude-code": "Claude Code" }

export function harnessLabel(harness: string): string {
  return harnesses[harness as Harness] ?? harness
}

const setupNames: Record<Setup, string> = { A: "bare", B: "Nuxt MCP + Nuxt skill", C: "Nuxt MCP + nuxt-skills", V: "Vue skills" }

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
  "fix-seats-race": "Seats oversold",
  "fix-cache-leak": "Another user's data",
  "fix-owner-check": "Strangers edit events",
  "fix-cached-search": "Search stuck on page 1",
  "fix-session-reads": "Session read per component",
  "fix-svg-cover": "Cover photo runs script",
  "fix-api-token": "Every page fails after sign-in",
  "scan-meetups": "Hidden bugs",
}

export function projectLabel(project: string): string {
  return projects[project] ?? project.split("-").map(word => word[0]!.toUpperCase() + word.slice(1)).join(" ")
}

/** What the project's prompt asks the agent to build with. */
const stacks: Record<string, string> = { "meetups": "Nuxt 5 + ViteHub", "meal-planner": "Vue only", "fix-api-token": "Nuxt 5" }

export function projectStack(project: string): string | undefined {
  return stacks[project] ?? (projectKind(project) === "build" ? undefined : "Nuxt 5 + ViteHub")
}

/**
 * `build`: the agent builds an app from a prompt. `fix`: it gets the Meetups app with one planted bug and a user's
 * report. `scan`: it reviews the Meetups app for planted bugs without running it. Project ids carry the kind.
 */
export function projectKind(project: string): "build" | "fix" | "scan" {
  return project.startsWith("fix-") ? "fix" : project.startsWith("scan-") ? "scan" : "build"
}

/** What a project's app does, in one sentence, for the Methodology page. */
const summaries: Record<string, string> = {
  "meetups": "A small meetup.com for tech events: sign-up with passkeys, cover photos, RSVPs with live seats and a reminder email the day before.",
  "meal-planner": "A meal planner over 20,289 recipes: households with diets and allergies, a pantry, a shopping list, share links, English and Spanish, and offline use. No backend.",
  "fix-seats-race": "The RSVP route reads the free seats, waits, then inserts, so people who RSVP at once oversell an event. Report: seats left goes negative.",
  "fix-cache-leak": "The event route caches who's going and who organizes under the event alone, so visitors see each other's answers. Report: an Edit button on someone else's event.",
  "fix-owner-check": "The edit and cover-removal routes check that someone is signed in, not that they organize the event. Report: someone changed my meetup's date.",
  "fix-cached-search": "The events list sits in a Nitro v3 cached handler, which drops the query string by default. Report: search and page 2 show the same events.",
  "fix-session-reads": "Every component reads the session again in the browser, and the server HTML shows the visitor signed out. Report: the header flashes Sign in, and get-session runs several times per page.",
  "fix-svg-cover": "The cover upload trusts the type the browser declares, so an SVG with a script gets in. Report: our security scanner says a cover photo runs JavaScript.",
  "fix-api-token": "Notebook, a small Nuxt 5 app whose API takes the token only in an Authorization header, which no request sends. Report: every page fails after sign-in. The common wrong fix reassigns globalThis.$fetch, which Nuxt never reads.",
  "scan-meetups": "The Meetups app with twelve planted bugs among correct code that looks wrong. The agent reviews it without running it and lists what it finds.",
}

export function projectSummary(project: string): string | undefined {
  return summaries[project]
}
