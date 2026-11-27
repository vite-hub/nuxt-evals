import { createError, defineHandler, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { type AgentSessionStep, readAgentSession } from "@vite-hub/agent/sessions"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database"
import { harnessLabel, readsSessions } from "../../../../shared/harnesses"
import type { SessionStepView, SessionView } from "../../../../shared/report"

const limit = 6000
// A diff is cut whole or not at all, so it gets more room than text.
const patchLimit = 24_000

function cut(text: string | undefined): string | undefined {
  if (!text) return undefined
  return text.length > limit ? `${text.slice(0, limit)}\n… ${text.length - limit} more characters` : text
}

function firstLine(text: string, max = 160): string {
  const line = text.trim().split("\n").find(Boolean) ?? ""
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function stringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return typeof value === "string" ? value : JSON.stringify(value, null, 2)
}

/**
 * The edit as `git diff` text, one file after another, from the hunks the session reader keeps. The run page shows it as
 * a diff. Codex keeps no hunks for a deleted file, so it gets only the git header. A patch longer than the cut stays out, so the page shows the agent's raw edit instead of a broken diff.
 */
function gitPatch(output: unknown): string | undefined {
  const changes = (output as { item?: { changes?: { path: string, kind?: string, diff: string }[] } } | undefined)?.item?.changes
  const patch = changes?.map(({ path, kind, diff }) => kind === "delete" && !diff
    ? `diff --git a/${path} b/${path}\ndeleted file mode 100644\n--- a/${path}\n+++ /dev/null\n`
    : diff ? `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n${diff}` : "").join("")
  return patch && patch.length <= patchLimit ? patch : undefined
}

/** One raw session step, in the few kinds the run page shows. */
function view(step: AgentSessionStep): SessionStepView {
  const base = { id: step.id, at: step.timestamp }
  if (step.type === "message") {
    if (step.phase === "reasoning") return { ...base, kind: "thinking", title: firstLine(step.text, 120) || "Thinking", body: cut(step.text) }
    return { ...base, kind: step.phase === "final" ? "final" : "message", title: firstLine(step.text, 120), body: cut(step.text) }
  }
  const input = step.input as { command?: string, query?: string } | undefined
  const output = step.output as { output?: string, exitCode?: number } | undefined
  const timing = { durationMs: step.durationMs, failed: Boolean(step.error) || (typeof output?.exitCode === "number" && output.exitCode !== 0) }
  if (step.kind === "change") {
    const command = input?.command ?? stringify(step.input) ?? ""
    const files = [...command.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map(match => match[1]!)
    return { ...base, ...timing, kind: "edit", title: files.length ? files.join(", ") : step.title ?? "Edit", body: gitPatch(step.output) ?? cut(command) }
  }
  if (typeof input?.command === "string") return { ...base, ...timing, kind: "command", title: firstLine(input.command), body: cut(output?.output ?? stringify(step.output)) }
  if (step.name === "update_plan" || step.name === "TodoWrite") return { ...base, ...timing, kind: "plan", title: "Plan", body: cut(stringify(step.input)) }
  if (/web_?search|web_?fetch/i.test(step.name)) return { ...base, ...timing, kind: "web", title: input?.query ?? step.title ?? step.name, body: cut(stringify(step.input)) }
  // Claude Code prefixes MCP tools with `mcp__`; Codex uses the server's tool names (the Nuxt MCP's start with get_ or list_).
  const mcp = /^mcp/.test(step.name) || step.name.includes(".") || /^(get|list)[_-](documentation|blog|changelog|deploy|getting|module|nuxter)/.test(step.name)
  return { ...base, ...timing, kind: mcp ? "mcp" : "tool", title: step.title ?? step.name, body: cut([stringify(step.input), stringify(step.output) ?? step.error].filter(Boolean).join("\n\n→\n\n")) }
}

/** The run's session, read from the raw file `POST /api/runs` kept in Blob. Public, like the Console's guest view. */
export default defineHandler(async (event): Promise<SessionView> => {
  const id = getRouterParam(event, "id")
  if (!id || !/^[\w.-]+$/.test(id)) throw createError({ status: 400, message: "Missing run id." })
  const { db, schema } = useDatabase("default")
  const [row] = await db.select({ harness: schema.runs.harness }).from(schema.runs).where(eq(schema.runs.id, id))
  if (!row) throw createError({ status: 404, message: "Run not found." })
  const [error, file] = await blob.get(`runs/${id}/session.jsonl`)
  if (error || !file) throw createError({ status: 404, message: "This run has no session file." })
  if (!readsSessions(row.harness)) throw createError({ status: 422, message: `The site can't read ${harnessLabel(row.harness)} sessions yet.` })
  const session = readAgentSession(row.harness, await file.text())
  return { prompt: session.prompt, steps: session.steps.map(view) }
})
