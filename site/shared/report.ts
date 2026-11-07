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
  /** A: bare. B: Nuxt MCP + core skills. C: B + the full nuxt-skills plugin. */
  setup: "A" | "B" | "C"
  repeat: number
  status: "passed" | "failed" | "error"
  /** Share of probes that passed, 0 to 1. */
  score: number
  startedAt: string
  durationMs: number
  usage: RunUsage
  probes: ProbeResult[]
  diagnostics: RunDiagnostics
  finalText: string
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
  mcpServers: string[]
  /** Commands that read outside the working copy. */
  outsideReads: string[]
  problems: string[]
}

export interface RunFile {
  path: string
  content: string
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
  /** The project's starting files. The site commits them to the Workspace's `main` ref when they changed. */
  base: RunFile[]
  /** The Comark summary. The site stores it in the `runs` Content collection. */
  summary?: string
}

export type RunSummary = RunRecord & { invocation?: string | null }
