import type { RunDiagnostics, RunUsage } from "../../../site/shared/report"

type Item = Record<string, unknown>

/**
 * Read usage, tool calls and the final text from the ViteHub Agent event stream (`output: "events"`).
 * Shapes seen with codexDriver on vite-hub 0.1.0: `tool-call` with `name` and `input`, `text-delta` with `delta`,
 * one `usage` with `usageRecord.usage`, and `data-agent-event` turn markers.
 */
export function summarizeEvents(events: unknown[]): { usage: RunUsage, diagnostics: Omit<RunDiagnostics, "error">, finalText: string } {
  const tools: string[] = []
  const commands: string[] = []
  const usage: RunUsage = {}
  const texts: string[] = [""]
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue
    const item = raw as Item
    if (item.type === "tool-call") {
      const name = typeof item.name === "string" ? item.name : "unknown"
      tools.push(name)
      const command = (item.input as Item | undefined)?.command
      if (typeof command === "string") commands.push(command)
      texts.push("")
    }
    if (item.type === "text-delta" && typeof item.delta === "string") texts[texts.length - 1] += item.delta
    if (item.type === "usage") {
      const found = (item.usageRecord as Item | undefined)?.usage as Item | undefined
      if (found) {
        usage.inputTokens = number(found.inputTokens)
        usage.outputTokens = number(found.outputTokens)
        usage.cachedInputTokens = number((found.inputTokenDetails as Item | undefined)?.cacheReadTokens)
        usage.reasoningTokens = number((found.outputTokenDetails as Item | undefined)?.reasoningTokens)
      }
    }
  }
  return {
    usage,
    // The text after the last tool call is the answer; earlier text is progress notes.
    finalText: (texts.findLast(text => text.trim()) ?? "").trim(),
    diagnostics: {
      toolCalls: tools.length,
      mcpCalls: tools.filter(name => name.startsWith("mcp")).length,
      skillReads: commands.filter(command => /SKILL\.md|\/skills\//.test(command)).length + tools.filter(name => /skill/i.test(name)).length,
      webFetches: tools.filter(name => name === "web_search" || /fetch/i.test(name)).length,
      tools: [...new Set(tools)],
    },
  }
}

function number(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined
}
