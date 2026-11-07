import { runAgent } from "vite-hub/agent"
import type { RunReport } from "../../../site/shared/report"
import summarizer from "../agents/summarizer"
import { comarkIssues } from "./comark-check"
import { summarizeEvents } from "./events"

/** A compact digest of the run, so the summarizer sees facts, not 100 raw events. */
export function digest(report: RunReport, prompt: string) {
  const steps = report.events.flatMap((raw) => {
    const item = raw as { type?: string, name?: string, input?: { command?: string, query?: string } }
    return item.type === "tool-call" ? [{ tool: item.name, command: (item.input?.command ?? item.input?.query ?? "").slice(0, 400) }] : []
  })
  return {
    task: report.task,
    agent: `${report.agent} ${report.model} (${report.reasoning} effort), setup ${report.setup}`,
    prompt,
    score: report.score,
    status: report.status,
    probes: report.probes.map(probe => ({ title: probe.title, layer: probe.layer, passed: probe.passed })),
    steps,
    finalAnswer: summarizeEvents(report.events).finalText,
    diff: report.diff.slice(0, 12_000),
    usage: report.usage,
    toolCalls: report.diagnostics.toolCalls,
    webFetches: report.diagnostics.webFetches,
    timeSeconds: Math.round(report.durationMs / 1000),
  }
}

async function ask(report: RunReport, prompt: string): Promise<string> {
  const [error, text] = await runAgent(summarizer, {
    prompt,
    context: { invoker: { id: `summary-${report.id}`, kind: "eval", label: `Summary of ${report.task} #${report.repeat}` } },
  }, { output: "drained" })
  if (error) throw error
  return String(text).replace(/^```(?:md|markdown)?\n([\s\S]*)\n```\s*$/, "$1").trim()
}

/** Write the summary, then let Comark check it. One retry with the reported issues; a second failure throws. */
export async function writeSummary(report: RunReport, taskPrompt: string): Promise<string> {
  const input = JSON.stringify(digest(report, taskPrompt), null, 2)
  const first = await ask(report, input)
  const issues = await comarkIssues(first)
  if (!issues.length) return first
  const second = await ask(report, `${input}\n\nYour previous summary had these Comark problems. Write it again without them:\n${issues.map(issue => `- ${issue}`).join("\n")}\n\nPrevious summary:\n${first}`)
  const remaining = await comarkIssues(second)
  if (remaining.length) throw new Error(`The summary still has Comark problems: ${remaining.join(" ")}`)
  return second
}
