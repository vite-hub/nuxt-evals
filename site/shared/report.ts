/** A coding agent CLI the evals run. It is also the Agent name in the site's Console. */
export type AgentName = "codex" | "claude-code"

/** One graded run. The CLI writes it to `.data/runs/<id>/run.json`; the site keeps it as a `runs` row. */
export interface RunRecord {
  id: string
  suite: string
  task: string
  agent: AgentName
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
  files: RunFile[]
  /** The Comark summary. The site stores it in the `runs` Content collection. */
  summary?: string
}

export type RunSummary = RunRecord & { invocation?: string | null }
