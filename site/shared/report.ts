/** One graded agent run. The runner builds it and posts it to `POST /api/runs`. */
export interface RunReport {
  id: string
  suite: string
  task: string
  agent: "codex" | "claude-code"
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
  /** The task prompt the agent got. */
  prompt?: string
  /** The Comark summary. The site stores it in the `runs` Content collection, not in the row. */
  summary?: string
  /** Stored in Blob, not in the database row. */
  events: unknown[]
  diff: string
  files: RunFile[]
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
  error?: string
}

export interface RunFile {
  path: string
  content: string
}

export type RunSummary = Omit<RunReport, "events" | "diff" | "files" | "summary" | "prompt"> & { invocation?: string | null }
