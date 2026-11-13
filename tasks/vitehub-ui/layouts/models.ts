import type { Harness, RunUsage } from "../../../site/shared/report.ts"

/**
 * The two models, at the effort `modelSet` in `cli/lib/agents.ts` gives them: Opus at medium (sent as
 * `output_config.effort` with adaptive thinking, as Claude Code sends `--effort`), Sol at xhigh (`reasoning.effort`).
 */
export const models = {
  opus: { harness: "claude-code", model: "claude-opus-5-5", effort: "medium" },
  sol: { harness: "codex", model: "gpt-6.1-sol", effort: "xhigh" },
} as const satisfies Record<string, { harness: Harness, model: string, effort: string }>

export type ModelName = keyof typeof models

export interface ModelReply {
  text: string
  usage: RunUsage
  /** The provider's stop or status reason. */
  stop?: string
}

function gateway() {
  const url = process.env.CLIPROXY_URL?.replace(/\/+$/, "").replace(/\/v1$/, "")
  const key = process.env.CLIPROXY_API_KEY
  if (!url || !key) throw new Error("Set CLIPROXY_URL and CLIPROXY_API_KEY, for example with node --env-file=cli/.env.")
  return { url, key }
}

async function post(path: string, body: object, headers: Record<string, string>): Promise<unknown> {
  const { url, key } = gateway()
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${key}`, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20 * 60_000),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${path} answered ${response.status}: ${text.slice(0, 500)}`)
  return JSON.parse(text)
}

const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const count = (value: unknown) => typeof value === "number" ? value : 0

async function anthropic(model: string, effort: string, system: string, user: string): Promise<ModelReply> {
  const { key } = gateway()
  const body = record(await post("/v1/messages", {
    model,
    max_tokens: 64_000,
    system,
    messages: [{ role: "user", content: user }],
    thinking: { type: "adaptive" },
    output_config: { effort },
  }, { "x-api-key": key, "anthropic-version": "2023-06-01" }))
  const usage = record(body.usage)
  const cached = count(usage.cache_read_input_tokens)
  const input = count(usage.input_tokens) + cached + count(usage.cache_creation_input_tokens)
  return {
    text: list(body.content).map(record).filter(block => block.type === "text").map(block => String(block.text)).join(""),
    usage: { inputTokens: input, cachedInputTokens: cached, outputTokens: count(usage.output_tokens), totalTokens: input + count(usage.output_tokens) },
    stop: typeof body.stop_reason === "string" ? body.stop_reason : undefined,
  }
}

async function openai(model: string, effort: string, system: string, user: string): Promise<ModelReply> {
  const body = record(await post("/v1/responses", {
    model,
    instructions: system,
    input: [{ role: "user", content: [{ type: "input_text", text: user }] }],
    reasoning: { effort },
    store: false,
  }, {}))
  const usage = record(body.usage)
  const text = list(body.output).map(record).filter(item => item.type === "message")
    .flatMap(item => list(item.content).map(record)).filter(part => part.type === "output_text").map(part => String(part.text)).join("")
  return {
    text,
    usage: {
      inputTokens: count(usage.input_tokens),
      cachedInputTokens: count(record(usage.input_tokens_details).cached_tokens),
      outputTokens: count(usage.output_tokens),
      reasoningTokens: count(record(usage.output_tokens_details).reasoning_tokens),
      totalTokens: count(usage.total_tokens),
    },
    stop: typeof body.status === "string" ? body.status : undefined,
  }
}

/** One plain model call through CLIProxy. No tools, no retries. */
export function callModel(name: ModelName, system: string, user: string): Promise<ModelReply> {
  const { model, effort } = models[name]
  return name === "opus" ? anthropic(model, effort, system, user) : openai(model, effort, system, user)
}
