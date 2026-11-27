// A run's session file as one AgentSession, read by `@vite-hub/agent/sessions`. Codex and Claude Code runs keep the
// CLI's own session file. A driver harness's run keeps the provider runtime's event log, which reads the same way, so
// the audit, the diagnostics and the final text work alike.
import { type AgentSession, isProviderRuntimeEventLog, readAgentSession } from "@vite-hub/agent/sessions"
import { type Harness, isSpawnHarness } from "./harnesses.ts"

export function readSession(harness: Harness, text: string): AgentSession {
  // A driver that failed before it started writes no event log.
  if (!isSpawnHarness(harness) && !isProviderRuntimeEventLog(text)) {
    return { provider: harness, status: "failed", steps: [], usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 }, error: "The harness wrote no event log." }
  }
  return readAgentSession(harness, text)
}
