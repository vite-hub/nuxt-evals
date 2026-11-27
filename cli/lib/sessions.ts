// A run's session file as one AgentSession. Codex and Claude Code runs keep the CLI's own session file, which
// `@vite-hub/agent/sessions` reads. A driver harness's run keeps the provider runtime's NDJSON event log (a `meta`
// line, then one runtime event per line), read here into the same shape so the audit, the diagnostics and the final
// text work the same way.
import { type AgentSession, type AgentSessionMessage, type AgentSessionStep, type AgentSessionTool, type AgentSessionUsage, readAgentSession } from "@vite-hub/agent/sessions"
import { type Harness, isSpawnHarness } from "./harnesses.ts"

export function readSession(harness: Harness, text: string): AgentSession {
  return isSpawnHarness(harness) ? readAgentSession(harness, text) : readRuntimeSession(harness, text)
}

interface RuntimeEvent {
  type: string
  eventId?: string
  itemId?: string
  createdAt?: string
  payload?: Record<string, unknown>
  // The meta line.
  kind?: string
  model?: string
  cwd?: string
  threadId?: string
  startedAt?: string
}

interface ItemData {
  toolName?: string
  command?: string
  output?: string
  exitCode?: number
  fileName?: string
  diff?: string
  text?: string
  phase?: string
  server?: string
  tool?: string
  error?: string
}

const textItems = new Set(["assistant_message", "reasoning", "user_message"])
const failedStates = new Set(["failed", "declined", "cancelled", "interrupted"])

function emptyUsage(): AgentSessionUsage {
  return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 }
}

function addUsage(total: AgentSessionUsage, usage: Record<string, unknown> | undefined): void {
  const count = (key: string) => typeof usage?.[key] === "number" ? usage[key] : 0
  total.inputTokens += count("inputTokens")
  total.cachedInputTokens += count("cachedInputTokens")
  total.outputTokens += count("outputTokens")
  total.reasoningTokens += count("reasoningTokens") || count("reasoningOutputTokens")
  total.totalTokens = total.inputTokens + total.outputTokens
}

/** The provider runtime event log of one Invocation, as an AgentSession. */
export function readRuntimeSession(harness: Harness, text: string): AgentSession {
  const session: AgentSession = { provider: harness as AgentSession["provider"], status: "failed", steps: [], usage: emptyUsage() }
  const items = new Map<string, AgentSessionStep>()
  const deltas = new Map<string, string>()
  const turnUsage = emptyUsage()
  const threadUsage = emptyUsage()
  let turnReportedUsage = false
  let completed = false
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    let event: RuntimeEvent
    try {
      event = JSON.parse(line) as RuntimeEvent
    }
    catch {
      continue
    }
    const payload = event.payload ?? {}
    const at = event.createdAt ?? ""
    if (event.type === "meta") {
      Object.assign(session, { ...event.threadId ? { id: event.threadId } : {}, ...event.cwd ? { cwd: event.cwd } : {}, ...event.model ? { model: event.model } : {}, ...event.startedAt ? { startedAt: event.startedAt } : {} })
      continue
    }
    if (event.type === "content.delta" && payload.streamKind === "assistant_text" && event.itemId) {
      deltas.set(event.itemId, (deltas.get(event.itemId) ?? "") + String(payload.delta ?? ""))
      continue
    }
    if (event.type === "thread.token-usage.updated") {
      addUsage(threadUsage, payload.usage as Record<string, unknown> | undefined)
      continue
    }
    if (event.type === "turn.completed") {
      completed = true
      if (payload.tokenUsage) {
        turnReportedUsage = true
        addUsage(turnUsage, payload.tokenUsage as Record<string, unknown>)
      }
      if (typeof payload.state === "string" && failedStates.has(payload.state)) {
        session.status = "failed"
        session.error = typeof payload.errorMessage === "string" ? payload.errorMessage : `The turn ${payload.state}.`
      }
      else {
        session.status = "completed"
        delete session.error
      }
      session.completedAt = at || session.completedAt
      continue
    }
    if (event.type === "runtime.error") {
      session.error = String((payload as { message?: unknown }).message ?? "The provider runtime failed.")
      continue
    }
    if (!event.type.startsWith("item.")) continue
    const itemType = String(payload.itemType ?? "")
    const id = event.itemId ?? event.eventId ?? `${session.steps.length}`
    const data = (payload.data ?? {}) as ItemData
    const status = String(payload.status ?? "")
    if (textItems.has(itemType)) {
      if (event.type !== "item.completed") continue
      const body = data.text ?? deltas.get(id) ?? ""
      if (itemType === "user_message") {
        session.prompt ??= body
        continue
      }
      const message: AgentSessionMessage = { type: "message", id, timestamp: at, phase: itemType === "reasoning" ? "reasoning" : data.phase === "final" ? "final" : "commentary", text: body }
      session.steps.push(message)
      continue
    }
    const known = items.get(id) as AgentSessionTool | undefined
    const tool: AgentSessionTool = known ?? { type: "tool", id, timestamp: at, name: itemType }
    if (!known) {
      items.set(id, tool)
      session.steps.push(tool)
    }
    tool.name = itemType === "command_execution" ? "command_execution" : itemType === "mcp_tool_call" && data.server ? `mcp__${data.server}__${data.tool ?? data.toolName ?? ""}` : data.toolName && data.toolName !== itemType ? data.toolName : itemType
    if (typeof payload.title === "string") tool.title = payload.title
    if (itemType === "file_change") {
      tool.kind = "change"
      tool.input = { path: data.fileName }
      if (data.diff) tool.output = { diff: data.diff }
    }
    else if (itemType === "command_execution") {
      if (data.command && data.command !== "{}") tool.input = { command: data.command }
      if (data.output !== undefined || data.exitCode !== undefined) tool.output = { output: data.output ?? "", ...data.exitCode === undefined ? {} : { exitCode: data.exitCode } }
    }
    else tool.input = data
    if (event.type === "item.completed") {
      tool.completedAt = at
      const duration = Date.parse(at) - Date.parse(tool.timestamp)
      if (Number.isFinite(duration)) tool.durationMs = duration
      if (failedStates.has(status) || (typeof data.exitCode === "number" && data.exitCode !== 0)) tool.error = data.error ?? (typeof payload.detail === "string" ? payload.detail : `${status || "failed"}`)
    }
  }
  if (!completed) session.error ??= "The session ended before the turn completed."
  session.usage = turnReportedUsage ? turnUsage : threadUsage
  const final = session.steps.filter((step): step is AgentSessionMessage => step.type === "message" && step.phase !== "reasoning").at(-1)
  if (final) session.text = final.text
  return session
}
