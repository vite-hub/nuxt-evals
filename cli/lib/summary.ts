import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText } from "ai"
import type { AgentSession } from "@vite-hub/agent/sessions"
import { parseMarkdown } from "comark"
import comarkUi from "comark-ui/html"
import type { RunRecord } from "../../site/shared/report.ts"

const instructions = `You write the public summary of one coding-agent eval run, in Comark Markdown, for Nuxt and Vue developers.

The input is a JSON digest: the task prompt, the probes and whether each passed (or, for rubric projects, the section scores and failed checks), the agent's steps (its notes, its thinking when recorded, and each tool call with its command), its final answer, the diff, token use and time. Use only facts from the digest. Copy every number exactly. Never invent a step, a file or a result.

Write, in this order:
1. One short paragraph: what the agent built and the verdict, with the score.
2. "## What stood out": 2 to 4 GitHub callouts. Use > [!TIP] for something the agent did well, > [!WARNING] for a risky or wrong choice, > [!NOTE] for something worth knowing (for example a web search, a wasted step, or an unusual primitive). One sentence or two each, with the evidence.
3. "## The code": the most important new or changed file as a fenced block with its language and title="path". Add numbered code notes: end the 2 to 4 lines a reviewer would ask about with a comment like // <1>, then a numbered list right after the fence, one sentence per note. Mark the key lines with mark={...} when it helps. Count lines carefully.
4. "## How it got there": a ::steps block with a numbered list, one item per meaningful step (merge trivial reads), each with the command in inline code.
5. "## Cost": a ::stats{tiles} block holding one Markdown table with exactly two columns, Metric | Value, and the rows Input tokens, Cached tokens, Output tokens, Est. cost (USD), Tool calls, Time (s). Values are plain numbers with commas, such as 166,961; the cost keeps its digits, such as $0.0412.
6. A ::details{summary="Final answer"} block with the agent's final answer as a quote.

Rules: plain, short sentences. No em dashes. No headings other than the ones above. No HTML. No emojis. Output only the Markdown, without front matter and without a surrounding code fence.`

/** A compact digest of the run, so the summarizer sees facts, not the raw session. */
export function digest(run: RunRecord, prompt: string, session: AgentSession, diff: string) {
  return {
    project: run.project,
    agent: `${run.harness} ${run.model} (${run.reasoning} effort), setup ${run.setup}`,
    prompt,
    score: run.rubric
      ? `${run.rubric.score} of 10, the weighted mean of ${run.rubric.sections.length} rubric sections graded by an Opus judge`
      : `${Math.round(run.score * 100)}% (${run.probes.filter(probe => probe.passed).length} of ${run.probes.length} probes)`,
    ...(run.rubric ? { sections: run.rubric.sections.map(section => ({ section: section.key, score: section.score, failedMajor: section.failedMajor, failedMinor: section.failedMinor })), failedChecks: run.rubric.checks.filter(check => check.outcome === "fail").map(check => ({ id: check.id, evidence: check.evidence.slice(0, 300) })) } : {}),
    status: run.status,
    probes: run.probes.map(probe => ({ title: probe.title, layer: probe.layer, passed: probe.passed })),
    steps: session.steps.map(step => step.type === "message"
      ? { [step.phase === "reasoning" ? "thinking" : "note"]: step.text.slice(0, 600) }
      : { tool: step.name, command: String((step.input as { command?: unknown } | undefined)?.command ?? JSON.stringify(step.input ?? "")).slice(0, 400), ...(step.error ? { error: step.error.slice(0, 200) } : {}) }),
    finalAnswer: run.finalText,
    diff: diff.slice(0, 12_000),
    usage: run.usage,
    toolCalls: run.diagnostics.toolCalls,
    webFetches: run.diagnostics.webFetches,
    timeSeconds: Math.round(run.durationMs / 1000),
  }
}

/** The problems Comark reports for a summary. The parse plugins match the site's comark-ui/vue renderer. */
export async function comarkIssues(markdown: string): Promise<string[]> {
  const { plugins } = comarkUi({ chips: { download: false }, icon: { fetch: false }, diagrams: { draw: false } })
  const document = await parseMarkdown(markdown, { plugins })
  const issues = (document.meta as { issues?: unknown[] }).issues ?? []
  return issues.map(issue => typeof issue === "string" ? issue : JSON.stringify(issue))
}

async function ask(prompt: string): Promise<string> {
  const url = process.env.CLIPROXY_URL?.replace(/\/+$/, "").replace(/\/v1$/, "")
  if (!url || !process.env.CLIPROXY_API_KEY) throw new Error("Set CLIPROXY_URL and CLIPROXY_API_KEY in cli/.env.")
  const provider = createOpenAICompatible({ name: "cliproxy", baseURL: `${url}/v1`, apiKey: process.env.CLIPROXY_API_KEY })
  const { text } = await generateText({ model: provider("claude-opus-5-5"), system: instructions, prompt })
  return text.replace(/^```(?:md|markdown)?\n([\s\S]*)\n```\s*$/, "$1").trim()
}

/** Write the summary with Opus 5.5, then let Comark check it. One retry with the reported issues. */
export async function writeSummary(input: ReturnType<typeof digest>): Promise<string> {
  const json = JSON.stringify(input, null, 2)
  const first = await ask(json)
  const issues = await comarkIssues(first)
  if (!issues.length) return first
  const second = await ask(`${json}\n\nYour previous summary had these Comark problems. Write it again without them:\n${issues.map(issue => `- ${issue}`).join("\n")}\n\nPrevious summary:\n${first}`)
  const remaining = await comarkIssues(second)
  if (remaining.length) throw new Error(`The summary still has Comark problems: ${remaining.join(" ")}`)
  return second
}
