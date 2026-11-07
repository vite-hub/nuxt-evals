import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Harness, RunUsage } from "../../site/shared/report.ts"

interface ModelPrice {
  input?: number
  output?: number
  cache_read?: number
}

const catalogUrl = "https://models.dev/api.json"
const cacheFile = join(homedir(), ".cache/nuxt-evals/models-dev.json")
const provider: Record<Harness, string> = { "codex": "openai", "claude-code": "anthropic" }

async function catalog(): Promise<Record<string, { models?: Record<string, { cost?: ModelPrice }> }>> {
  const fresh = await stat(cacheFile).then(info => Date.now() - info.mtimeMs < 24 * 60 * 60_000, () => false)
  if (!fresh) {
    const response = await fetch(catalogUrl)
    if (!response.ok) throw new Error(`models.dev answered ${response.status}.`)
    await mkdir(join(homedir(), ".cache/nuxt-evals"), { recursive: true })
    await writeFile(cacheFile, await response.text())
  }
  return JSON.parse(await readFile(cacheFile, "utf8"))
}

/**
 * The list price of a run's tokens, in USD, from models.dev. Cached input is billed at the cache-read price, and the
 * rest of the input at the input price. The CLIs report tokens per session, not per request, so long-context tiers
 * are ignored: the result is an estimate.
 */
export async function priceUsage(harness: Harness, model: string, usage: RunUsage): Promise<RunUsage> {
  const price = (await catalog().catch(() => undefined))?.[provider[harness]]?.models?.[model]?.cost
  if (!price?.input || !price.output) return usage
  const cached = usage.cachedInputTokens ?? 0
  const uncached = Math.max(0, (usage.inputTokens ?? 0) - cached)
  const usd = (uncached * price.input + cached * (price.cache_read ?? price.input) + (usage.outputTokens ?? 0) * price.output) / 1_000_000
  return { ...usage, costUsd: usd.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""), costSource: "models.dev" }
}
