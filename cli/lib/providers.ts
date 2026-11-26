// Where the agents, the judge and the summary send their model calls: a ViteHub AI gateway
// (https://vitehub.dev/docs/gateways). EVALS_GATEWAY names one preset for both harnesses, such as cliproxy for
// subscription logins or openrouter. Without it, Claude Code goes to Anthropic and Codex to OpenAI, with their API keys.
import { anthropic, cliproxy, litellm, ollama, openai, openrouter, vercel } from "@vite-hub/gateways"
import { languageModel } from "@vite-hub/gateways/ai-sdk"
import { aiGatewaySupports, normalizeAiGateway, resolveAiGatewayRoute } from "@vite-hub/gateways/internal"

const presets = { anthropic, cliproxy, litellm, ollama, openai, openrouter, vercel }
type Harness = "claude-code" | "codex"

function gateway(harness: Harness) {
  const name = process.env.EVALS_GATEWAY || (harness === "codex" ? "openai" : "anthropic")
  if (!Object.hasOwn(presets, name)) throw new Error(`EVALS_GATEWAY=${name} is not one of ${Object.keys(presets).join(", ")}.`)
  const value = presets[name as keyof typeof presets]()
  if (!aiGatewaySupports(normalizeAiGateway(value), harness)) throw new Error(`The ${name} gateway doesn't serve ${harness === "codex" ? "Codex" : "Claude Code"}. Set EVALS_GATEWAY to one that serves both, such as cliproxy or openrouter.`)
  return { name, value }
}

async function route(harness: Harness) {
  const { name, value } = gateway(harness)
  return { name, ...await resolveAiGatewayRoute(normalizeAiGateway(value), harness, {}) }
}

/** The variables that point a Claude Code process, an agent or the judge, at its model API. */
export async function claudeCodeEnv(): Promise<Record<string, string>> {
  const { apiKey, auth, baseURL, headers } = await route("claude-code")
  return {
    ANTHROPIC_BASE_URL: baseURL,
    ...auth === "bearer" ? { ANTHROPIC_AUTH_TOKEN: apiKey, ANTHROPIC_API_KEY: "" } : { ANTHROPIC_API_KEY: apiKey },
    ...headers.length ? { ANTHROPIC_CUSTOM_HEADERS: headers.map(([header, value]) => `${header}: ${value}`).join("\n") } : {},
  }
}

/** Codex's model provider, as `-c` overrides, and the variables that carry its key and headers. */
export async function codexProvider(): Promise<{ config: string[], env: Record<string, string> }> {
  const { name, apiKey, baseURL, headers } = await route("codex")
  // "openai" is Codex's built-in provider, which a config can't redefine.
  const id = name === "openai" ? "openai-api" : name
  const headerEnv = headers.map(([header, value], index) => ({ header, name: `EVALS_GATEWAY_HEADER_${index}`, value }))
  return {
    config: [
      `model_provider="${id}"`,
      `model_providers.${id}.name="${name}"`,
      `model_providers.${id}.base_url=${JSON.stringify(baseURL)}`,
      `model_providers.${id}.wire_api="responses"`,
      `model_providers.${id}.env_key="EVALS_GATEWAY_KEY"`,
      ...headerEnv.length ? [`model_providers.${id}.env_http_headers={${headerEnv.map(entry => `${JSON.stringify(entry.header)}=${JSON.stringify(entry.name)}`).join(",")}}`] : [],
    ],
    env: { EVALS_GATEWAY_KEY: apiKey, ...Object.fromEntries(headerEnv.map(entry => [entry.name, entry.value])) },
  }
}

/** The judge's model for the run summary, through the judge's gateway. */
export function summaryModel(modelId: string) {
  return languageModel(gateway("claude-code").value, modelId)
}
