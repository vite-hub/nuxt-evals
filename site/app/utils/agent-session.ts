import type { AgentSessionItem, AgentSessionWorkEntry } from "@vite-hub/ui/agent-session"
import type { SessionStepView, SessionView } from "#shared/report"

const elapsed = (ms: number) => ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`

const kinds: Record<Exclude<SessionStepView["kind"], "message" | "final">, AgentSessionWorkEntry["kind"]> = {
  thinking: "thinking",
  command: "command",
  edit: "edit",
  plan: "plan",
  mcp: "mcp",
  web: "web",
  tool: "tool",
}

function entry(step: SessionStepView & { kind: keyof typeof kinds }): AgentSessionWorkEntry {
  // A command that reads a SKILL.md is the agent reading a skill, so it shows as one.
  const skill = step.kind === "command" && /SKILL\.md|\/\.(codex|claude)\/skills\//.test(step.title)
  const title = step.kind === "thinking" ? "Thinking" : step.title
  return {
    id: step.id,
    kind: skill ? "skill" : kinds[step.kind],
    label: title,
    preview: step.kind === "thinking" ? step.title.replaceAll("**", "") : undefined,
    detail: step.body,
    status: step.failed ? "error" : "done",
    trailing: step.durationMs === undefined ? undefined : elapsed(step.durationMs),
  }
}

/** The run's session as AgentSession turns: the prompt, the agent's messages, and its tool calls folded between them. */
export function sessionItems(session: SessionView): AgentSessionItem[] {
  const items: AgentSessionItem[] = session.prompt ? [{ type: "user", id: "prompt", text: session.prompt }] : []
  let group: { first: string, last: string, entries: AgentSessionWorkEntry[] } | undefined
  const flush = () => {
    if (!group) return
    const ms = Date.parse(group.last) - Date.parse(group.first)
    items.push({ type: "work", id: `work-${items.length}`, label: ms >= 1000 ? `Worked for ${elapsed(ms)}` : undefined, entries: group.entries })
    group = undefined
  }
  for (const step of session.steps) {
    if (step.kind === "message" || step.kind === "final") {
      flush()
      items.push({ type: "assistant", id: step.id, text: step.body ?? step.title })
      continue
    }
    group ??= { first: step.at, last: step.at, entries: [] }
    group.last = step.at
    group.entries.push(entry(step as SessionStepView & { kind: keyof typeof kinds }))
  }
  flush()
  return items
}
