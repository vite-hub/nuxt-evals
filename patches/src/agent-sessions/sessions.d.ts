import type { AgentInvocationAnnotationValue, AgentInvocationStore, AgentInvocationStoreCreateInput } from "./index.js";

//#region src/sessions.d.ts
/** A coding agent CLI whose session files ViteHub reads. */
type AgentSessionProvider = "claude-code" | "codex";
interface AgentSessionUsage {
  inputTokens: number;
  /** Included in `inputTokens`. */
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}
/** Assistant text. `reasoning` is thinking, `commentary` is a progress note, `final` is the answer. */
interface AgentSessionMessage {
  type: "message";
  id: string;
  timestamp: string;
  phase: "commentary" | "final" | "reasoning";
  text: string;
}
/**
* One tool call. Commands use the name `command_execution` with `input.command`, and `output.output` and
* `output.exitCode` when known. File edits have `kind: "change"` and `output.item.changes` with unified diff hunks.
*/
interface AgentSessionTool {
  type: "tool";
  id: string;
  timestamp: string;
  completedAt?: string;
  durationMs?: number;
  name: string;
  title?: string;
  kind?: "change" | "tool";
  input?: unknown;
  output?: unknown;
  error?: string;
}
type AgentSessionStep = AgentSessionMessage | AgentSessionTool;
/** A provider session file, read into one provider-neutral shape. */
interface AgentSession {
  provider: AgentSessionProvider;
  /** The provider's session id. */
  id?: string;
  cwd?: string;
  model?: string;
  reasoningEffort?: string;
  /** Version of the provider CLI that wrote the file. */
  version?: string;
  startedAt?: string;
  completedAt?: string;
  status: "completed" | "failed";
  error?: string;
  /** The first user message. */
  prompt?: string;
  /** The final answer. */
  text?: string;
  steps: AgentSessionStep[];
  usage: AgentSessionUsage;
}
interface AgentSessionImportOptions {
  /** The Agent the session belongs to. The Console lists it under this name. */
  agentName: string;
  /** Your id for the run. Importing the same `agentName` and `runId` again replaces the record. */
  runId: string;
  invoker?: {
    id: string;
    kind?: string;
    label?: string;
  };
  /** The session title in the Console. */
  title?: string;
  annotations?: Record<string, AgentInvocationAnnotationValue>;
}
interface AgentSessionImportResult {
  /** The Invocation record id. The Console opens it at `/_vitehub/agents/<agentName>/invocations/<id>`. */
  id: string;
  created: boolean;
  replaced: boolean;
}
/** Read a Codex session file (`$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl`). */
declare function readCodexSession(text: string): AgentSession;
/** Read a Claude Code session file (`$CLAUDE_CONFIG_DIR/projects/<project>/<session>.jsonl`). */
declare function readClaudeCodeSession(text: string): AgentSession;
/** Read a session file of a known provider. */
declare function readAgentSession(provider: AgentSessionProvider, text: string): AgentSession;
/** The finished Agent Invocation record of a session, with the session's own timestamps. */
declare function agentSessionInvocation(session: AgentSession, options: AgentSessionImportOptions): Promise<AgentInvocationStoreCreateInput>;
/** Write a session to an Agent Invocation store as a finished Invocation. */
declare function importAgentSession(store: AgentInvocationStore, session: AgentSession, options: AgentSessionImportOptions): Promise<AgentSessionImportResult>;
//#endregion
export { type AgentSession, type AgentSessionImportOptions, type AgentSessionImportResult, type AgentSessionMessage, type AgentSessionProvider, type AgentSessionStep, type AgentSessionTool, type AgentSessionUsage, agentSessionInvocation, importAgentSession, readAgentSession, readClaudeCodeSession, readCodexSession };
