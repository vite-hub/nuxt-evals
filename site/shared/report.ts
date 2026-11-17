import type { Rubric, RubricGrade } from "./rubric"

/**
 * A: bare. B: Nuxt MCP + the core Nuxt skill. C: the Nuxt MCP + the skill nuxt-skill-hub generates for the project.
 * V: the core Vue skills, no MCP, for apps without Nuxt.
 */
export type Setup = "A" | "B" | "C" | "V"
export const setupIds: Setup[] = ["A", "B", "C", "V"]

/** The coding agent CLI a run uses. Every run is a session of the one Console Agent, `coding-agent`. */
export type Harness = "codex" | "claude-code"

/** The Console Agent that owns every imported session. The harness is a field of the session, not a second Agent. */
export const consoleAgentName = "coding-agent"

/** One graded run. The CLI writes it to `.data/runs/<id>/run.json`; the site keeps it as a `runs` row. */
export interface RunRecord {
  id: string
  /** A batch of runs, for example `pilot-1`. */
  suite: string
  /** The project under `tasks/`, for example `meetups`. */
  project: string
  harness: Harness
  model: string
  reasoning: string
  setup: Setup
  repeat: number
  status: "passed" | "failed" | "error"
  /** 0 to 1: the share of probes that passed, or for rubric projects the headline score over 10. */
  score: number
  startedAt: string
  durationMs: number
  usage: RunUsage
  probes: ProbeResult[]
  diagnostics: RunDiagnostics
  finalText: string
  /** The Opus judge's grade against RUBRIC.md, for rubric projects. */
  rubric?: RubricGrade | null
}

export interface RunUsage {
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  reasoningTokens?: number
  totalTokens?: number
  /** Estimated USD price of the run, from models.dev list prices. The CLIs report no cost. */
  costUsd?: string
  costSource?: string
}

export interface ProbeResult {
  id: string
  title: string
  layer: "gate" | "runtime" | "static" | "judge"
  passed: boolean
  detail?: string
}

export interface RunDiagnostics {
  toolCalls: number
  mcpCalls: number
  skillReads: number
  webFetches: number
  tools: string[]
  /** What the agent was offered, read from its session. A run fails the audit when it saw more than its setup allows. */
  audit?: RunAudit
  error?: string
}

export interface RunAudit {
  passed: boolean
  skills: string[]
  /** Hash of the setup's skill snapshot the run got (`setups/sources.json` records where each came from). */
  skillsHash?: string
  /** Files of the offered skills the agent read, relative to its skills folder, in the order it first read them. */
  skillFiles?: string[]
  mcpServers: string[]
  /** Commands that read outside the working copy. */
  outsideReads: string[]
  problems: string[]
}

export interface RunFile {
  path: string
  /** The text, or for a binary file (an image, a font) its bytes in base64. */
  content: string
  /** `base64` for a binary file. The CLI keeps them so a regrade can build the app; the site stores text files only. */
  encoding?: "base64"
}

/** What `evals push` sends to `POST /api/runs`. */
export interface RunUpload {
  run: RunRecord
  prompt: string
  /** The agent's own session file, as written by the agent CLI. */
  session: string
  diff: string
  /** The working copy after the run, without dependencies. The site commits it to the project's Workspace on ref `<run id>`. */
  files: RunFile[]
  /** The project's starting files. The run's Workspace commit records which `main` revision they are. */
  base: RunFile[]
  /** The Comark summary. The site stores it in the `runs` Content collection. */
  summary?: string
}

export type RunSummary = RunRecord & { invocation?: string | null }

/** One step of a run's session as the run page shows it. Built from the raw session file by `GET /api/runs/:id/session`. */
export interface SessionStepView {
  id: string
  kind: "message" | "final" | "thinking" | "command" | "edit" | "plan" | "mcp" | "web" | "tool"
  /** One line: the command, the edited files, the tool name, or the start of a message. */
  title: string
  /** The full message, command output, patch or tool input, cut to a few kB. */
  body?: string
  failed?: boolean
  durationMs?: number
  at: string
}

export interface SessionView {
  prompt?: string
  steps: SessionStepView[]
}

export interface WorkspaceView {
  ref: string
  revision: string
  base?: string
  paths: string[]
  changes: { path: string, status: "added" | "modified" | "deleted" }[]
}

/** A probe as the project page lists it, before any run. */
export interface ProjectProbe {
  id: string
  title: string
  layer: ProbeResult["layer"]
  why?: string
}

/** What `evals base` sends to `POST /api/projects/:project/base`: the starting app, the prompt, and the probes. */
export interface BaseUpload {
  title: string
  prompt: string
  probes: ProjectProbe[]
  /** The starting app, or for projects that start empty, the reference app. */
  files: RunFile[]
  /** Rubric projects: the checks, and the judge's grade of the reference app. */
  rubric?: Rubric
  reference?: RubricGrade
  /** `build`: the agent builds an app. `fix`: it fixes one planted bug. `scan`: it reviews an app for planted bugs. */
  kind?: ProjectKind
  /** Fix projects: the reference's change to the starting app, as a patch. */
  bestFix?: string
}

export type ProjectKind = "build" | "fix" | "scan"

/** The starting app of a project: Workspace `main`, with the prompt and probes that `evals base` stored on it. */
export interface ProjectView {
  project: string
  title: string
  revision: string
  createdAt: string
  prompt?: string
  probes: ProjectProbe[]
  /** Rubric projects: the files are the reference app, which agents never see. Fix and scan projects: the starting app. */
  rubric?: Rubric
  reference?: RubricGrade
  kind: ProjectKind
  /** Fix projects: the reference's change to the starting app, as a patch. */
  bestFix?: string
  /** Versions from the starting app's package.json, such as `nuxt`. */
  stack: { name: string, version: string }[]
  paths: string[]
}
