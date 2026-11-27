/**
 * Every coding agent CLI a run can name, with what the site and the CLI show and price it by. A harness the CLI can
 * run also has an entry in `cli/lib/harnesses.ts`; the others are here so a run from one shows its name, not its id.
 * - `lab`: the models.dev provider of the harness's own models, which prices a model no other rule finds.
 * - `tone`: the CSS variable of its color in charts. Without one in main.css, a harness takes `--tone-other`.
 * - `sessions`: `@vite-hub/agent/sessions` reads its session files, so the site can import its runs.
 */
export interface HarnessInfo {
  label: string
  lab?: string
  tone: `--tone-${string}`
  sessions?: true
}

export const harnessInfo = {
  "codex": { label: "Codex", lab: "openai", tone: "--tone-codex", sessions: true },
  "claude-code": { label: "Claude Code", lab: "anthropic", tone: "--tone-claude", sessions: true },
  "gemini": { label: "Gemini CLI", lab: "google", tone: "--tone-gemini" },
  "antigravity": { label: "Antigravity", lab: "google", tone: "--tone-gemini" },
  "opencode": { label: "OpenCode", lab: "opencode", tone: "--tone-opencode" },
  "cursor": { label: "Cursor", tone: "--tone-cursor" },
  "grok": { label: "Grok", lab: "xai", tone: "--tone-grok" },
  "kimi": { label: "Kimi Code", lab: "moonshotai", tone: "--tone-kimi" },
  "pi": { label: "Pi", tone: "--tone-pi" },
  "kiro": { label: "Kiro", tone: "--tone-kiro" },
  "fx": { label: "FX", tone: "--tone-fx" },
  "muse": { label: "Muse", tone: "--tone-muse" },
  "acp": { label: "ACP agent", tone: "--tone-acp" },
} as const satisfies Record<string, HarnessInfo>

export type HarnessId = keyof typeof harnessInfo

/** The harnesses whose sessions ViteHub reads: `@vite-hub/agent/sessions`' `AgentSessionProvider`. */
export type SessionHarness = { [Id in HarnessId]: (typeof harnessInfo)[Id] extends { sessions: true } ? Id : never }[HarnessId]

export function readsSessions(harness: string): harness is SessionHarness {
  return info(harness)?.sessions === true
}

function info(harness: string): HarnessInfo | undefined {
  return Object.hasOwn(harnessInfo, harness) ? harnessInfo[harness as HarnessId] : undefined
}

/** `Claude Code`. An id the table doesn't know reads as itself in title case: `qwen-code` → `Qwen Code`. */
export function harnessLabel(harness: string): string {
  return info(harness)?.label ?? harness.split("-").map(word => word && word[0]!.toUpperCase() + word.slice(1)).join(" ")
}

/** The harness's chart color, as a CSS value. */
export function harnessColor(harness: string): string {
  return `var(${info(harness)?.tone ?? "--tone-other"}, var(--tone-other))`
}

/** The models.dev provider of the harness's own lab, if it has one. */
export function harnessLab(harness: string): string | undefined {
  return info(harness)?.lab
}

/**
 * A path a harness reads a skill from: any SKILL.md, or a file in a user or project skills folder of a harness in the
 * table (`.codex/skills`, `.claude/skills`, `.gemini/skills`, `.agents/skills`, `.config/opencode/skills`,
 * `.opencode/skills`, `.pi/agent/skills`, `.pi/skills`, `.kimi-code/skills`).
 */
export const skillPath = /SKILL\.md|\/\.(?:codex|claude|gemini|agents|kimi-code|opencode|config\/opencode|pi(?:\/agent)?)\/skills\//
