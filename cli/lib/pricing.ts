import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { harnessLab } from "../../site/shared/harnesses.ts"
import type { RunUsage } from "../../site/shared/report.ts"

interface ModelPrice {
  input?: number
  output?: number
  cache_read?: number
}

const catalogUrl = "https://models.dev/api.json"
const cacheFile = join(homedir(), ".cache/nuxt-evals/models-dev.json")

export type Catalog = Record<string, { models?: Record<string, { cost?: ModelPrice }> }>

async function catalog(refresh = false): Promise<Catalog> {
  const fresh = !refresh && await stat(cacheFile).then(info => Date.now() - info.mtimeMs < 24 * 60 * 60_000, () => false)
  if (!fresh) {
    const response = await fetch(catalogUrl)
    if (!response.ok) throw new Error(`models.dev answered ${response.status}.`)
    await mkdir(join(homedir(), ".cache/nuxt-evals"), { recursive: true })
    await writeFile(cacheFile, await response.text())
  }
  return JSON.parse(await readFile(cacheFile, "utf8"))
}

export interface ResolvedPrice {
  /** The models.dev provider whose list price this is. */
  provider: string
  price: ModelPrice
}

/**
 * Which models.dev entry prices a model. The first that lists an input and an output price wins:
 * 1. A `provider/model` id whose provider models.dev knows: `moonshotai/kimi-k3` is Moonshot AI's `kimi-k3`.
 * 2. The gateway the calls went through, when models.dev lists it (openrouter, vercel), under the whole id.
 * 3. The harness's own lab: Anthropic for Claude Code, OpenAI for Codex.
 * 4. The one provider that lists the id. A model many resellers list gets no price, since theirs differ.
 */
export function resolvePrice(models: Catalog, query: { model: string, gateway?: string, lab?: string }): ResolvedPrice | undefined {
  const priced = (provider: string, id: string): ResolvedPrice | undefined => {
    const price = Object.hasOwn(models, provider) ? models[provider]!.models?.[id]?.cost : undefined
    return price?.input && price.output ? { provider, price } : undefined
  }
  const { model, gateway, lab } = query
  const slash = model.indexOf("/")
  const tries: [provider: string | undefined, id: string][] = [[slash > 0 ? model.slice(0, slash) : undefined, model.slice(slash + 1)], [gateway, model], [lab, model]]
  for (const [provider, id] of tries) {
    const found = provider && priced(provider, id)
    if (found) return found
  }
  const everywhere = Object.keys(models).flatMap(provider => priced(provider, model) ?? [])
  return everywhere.length === 1 ? everywhere[0] : undefined
}

/** USD for the tokens at a list price: cached input at the cache-read price, the rest of the input at the input price. */
function usageCost(price: ModelPrice, usage: RunUsage): string {
  const cached = usage.cachedInputTokens ?? 0
  const uncached = Math.max(0, (usage.inputTokens ?? 0) - cached)
  const usd = (uncached * price.input! + cached * (price.cache_read ?? price.input!) + (usage.outputTokens ?? 0) * price.output!) / 1_000_000
  return usd.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
}

/** The usage with its price from this catalog, or undefined when no entry prices the model. */
export function priceFrom(models: Catalog, harness: string, model: string, usage: RunUsage, gateway = process.env.EVALS_GATEWAY): RunUsage | undefined {
  const found = resolvePrice(models, { model, gateway, lab: harnessLab(harness) })
  return found && { ...usage, costUsd: usageCost(found.price, usage), costSource: `models.dev/${found.provider}` }
}

/**
 * The list price of a run's tokens, in USD, from models.dev (`resolvePrice` picks the entry, `costSource` names it).
 * The CLIs report tokens per session, not per request, so long-context tiers are ignored: the result is an estimate.
 */
export async function priceUsage(harness: string, model: string, usage: RunUsage): Promise<RunUsage> {
  const lookup = (models: Catalog | undefined) => models && priceFrom(models, harness, model, usage)
  // A model released after the cache was written is missing from it, so a miss fetches the catalog again.
  return lookup(await catalog().catch(() => undefined)) ?? lookup(await catalog(true).catch(() => undefined)) ?? usage
}
