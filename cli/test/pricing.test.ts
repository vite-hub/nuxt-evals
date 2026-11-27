// Which models.dev entry prices a run. The fixture is a trimmed models.dev snapshot (2026-11-27): only the providers
// and models these tests name, with their real ids and list prices.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { type Catalog, priceFrom, resolvePrice } from "../lib/pricing.ts"

const models: Catalog = JSON.parse(readFileSync(new URL("fixtures/models-dev.json", import.meta.url), "utf8"))
const providerOf = (query: Parameters<typeof resolvePrice>[1]) => resolvePrice(models, query)?.provider

test("a provider/model id takes that provider's price, even through a gateway that lists the same id", () => {
  assert.equal(providerOf({ model: "moonshotai/kimi-k3" }), "moonshotai")
  assert.equal(providerOf({ model: "moonshotai/kimi-k3", gateway: "openrouter", lab: "anthropic" }), "moonshotai")
})

test("a gateway models.dev lists prices the whole id, and one it doesn't list falls through to the lab", () => {
  // z-ai is not a models.dev provider, so the id is OpenRouter's own.
  assert.equal(providerOf({ model: "z-ai/glm-5.1", gateway: "openrouter", lab: "anthropic" }), "openrouter")
  assert.equal(providerOf({ model: "claude-opus-5-5", gateway: "cliproxy", lab: "anthropic" }), "anthropic")
  // OpenRouter keys Claude as anthropic/claude-opus-5-5, so the bare id misses it and the lab prices it.
  assert.equal(providerOf({ model: "claude-opus-5-5", gateway: "openrouter", lab: "anthropic" }), "anthropic")
})

test("a model no rule names is priced only when one provider lists it", () => {
  assert.equal(providerOf({ model: "kimi-latest", lab: "anthropic" }), "privatemode-ai")
  // Anthropic and OpenCode both list Opus, at their own prices, and Codex's lab (OpenAI) doesn't.
  assert.equal(providerOf({ model: "claude-opus-5-5", lab: "openai" }), undefined)
  assert.equal(providerOf({ model: "no-such-model", lab: "openai" }), undefined)
})

test("Opus, Fable and Sol runs cost what they were priced at before, now with the provider named", () => {
  const runs = [
    // 20261113-2104-meal-planner-opus-a3
    { harness: "claude-code", model: "claude-opus-5-5", usage: { inputTokens: 18300676, cachedInputTokens: 17994901, outputTokens: 211326, reasoningTokens: 0, totalTokens: 18512002 }, costUsd: "9.0486", provider: "anthropic" },
    // 20261113-1911-meal-planner-fable-a3
    { harness: "claude-code", model: "claude-fable-5-2", usage: { inputTokens: 21318778, cachedInputTokens: 20380191, outputTokens: 427283, reasoningTokens: 0, totalTokens: 21746061 }, costUsd: "28.676054", provider: "anthropic" },
    // 20261117-2246-meal-planner-sol-v2
    { harness: "codex", model: "gpt-6.1-sol", usage: { inputTokens: 5770586, cachedInputTokens: 5702400, outputTokens: 105368, reasoningTokens: 21869, totalTokens: 5875954 }, costUsd: "1.760292", provider: "openai" },
  ]
  for (const run of runs) {
    for (const gateway of [undefined, "cliproxy", "anthropic", "openai"]) {
      assert.deepEqual(priceFrom(models, run.harness, run.model, run.usage, gateway), { ...run.usage, costUsd: run.costUsd, costSource: `models.dev/${run.provider}` }, `${run.model} through ${gateway ?? "no gateway"}`)
    }
  }
})

test("an unpriced model leaves the usage without a cost", () => {
  assert.equal(priceFrom(models, "codex", "claude-opus-5-5", { inputTokens: 10 }, undefined), undefined)
})
