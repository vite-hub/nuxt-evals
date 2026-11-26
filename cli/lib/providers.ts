// Where the agents, the judge and the summary send their model calls. A CLIProxy (CLIPROXY_URL and CLIPROXY_API_KEY)
// serves both harnesses, with subscription logins. Without one, Claude Code uses ANTHROPIC_API_KEY and Codex
// OPENAI_API_KEY, each with an optional base URL for any compatible endpoint.
import { anthropic, cliproxy } from "@vite-hub/gateways"
import { languageModel } from "@vite-hub/gateways/ai-sdk"

function proxy(): { url: string, key: string } | undefined {
  const url = process.env.CLIPROXY_URL?.replace(/\/+$/, "").replace(/\/v1$/, "")
  const key = process.env.CLIPROXY_API_KEY
  return url && key ? { url, key } : undefined
}

/** The variables that point a Claude Code process, an agent or the judge, at its model API. */
export function claudeCodeEnv(): Record<string, string> {
  const gateway = proxy()
  if (gateway) return { ANTHROPIC_BASE_URL: gateway.url, ANTHROPIC_AUTH_TOKEN: gateway.key, ANTHROPIC_API_KEY: "" }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in cli/.env, or CLIPROXY_URL and CLIPROXY_API_KEY.")
  const url = process.env.ANTHROPIC_BASE_URL?.replace(/\/+$/, "")
  return { ANTHROPIC_API_KEY: key, ...(url ? { ANTHROPIC_BASE_URL: url } : {}) }
}

/** Codex's model provider, as `-c` overrides, and the variable that carries its key. */
export function codexProvider(): { config: string[], env: Record<string, string> } {
  const gateway = proxy()
  const provider = gateway
    ? { id: "cliproxy", name: "CLIProxy", url: `${gateway.url}/v1`, keyName: "CLIPROXY_API_KEY", key: gateway.key }
    : { id: "openai-api", name: "OpenAI API", url: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, ""), keyName: "OPENAI_API_KEY", key: process.env.OPENAI_API_KEY }
  if (!provider.key) throw new Error("Set OPENAI_API_KEY in cli/.env, or CLIPROXY_URL and CLIPROXY_API_KEY.")
  return {
    config: [
      `model_provider="${provider.id}"`,
      `model_providers.${provider.id}.name="${provider.name}"`,
      `model_providers.${provider.id}.base_url=${JSON.stringify(provider.url)}`,
      `model_providers.${provider.id}.wire_api="responses"`,
      `model_providers.${provider.id}.env_key="${provider.keyName}"`,
    ],
    env: { [provider.keyName]: provider.key },
  }
}

/** Opus 5.5 for the run summary, through the same route as the judge. */
export function summaryModel() {
  return languageModel(proxy() ? cliproxy() : anthropic(), "claude-opus-5-5")
}
