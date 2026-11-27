// Where the agents, the judge and the summary send their model calls: a ViteHub AI gateway
// (https://vitehub.dev/docs/gateways). EVALS_GATEWAY names one preset for every harness, such as cliproxy for
// subscription logins or openrouter. Without it, Claude Code goes to Anthropic, Codex to OpenAI, and the other
// harnesses to their own preset (harnesses.ts). A harness no gateway can serve signs in with its own key.
import { aiGatewayHarnessRoute, aiGatewayHarnessRoutes, alibaba, anthropic, cliproxy, cloudflare, deepseek, google, litellm, minimax, moonshot, ollama, openai, openrouter, typesafe, vercel, zai } from "@vite-hub/gateways"
import { languageModel } from "@vite-hub/gateways/ai-sdk"
import { normalizeAiGateway, resolveAiGatewayRoute } from "@vite-hub/gateways/internal"
import { type Harness, harnesses } from "./harnesses.ts"

export const presets = { alibaba, anthropic, cliproxy, cloudflare, deepseek, google, litellm, minimax, moonshot, ollama, openai, openrouter, typesafe, vercel, zai }

/** True when ViteHub can route the harness through a gateway, rather than the harness signing in to its own service. */
export function gatewayServes(harness: Harness): boolean {
  return (aiGatewayHarnessRoutes[harness]?.length ?? 0) > 0
}

/** The gateway preset a harness's model calls go to: EVALS_GATEWAY, else the harness's own. */
export function gatewayName(harness: Harness): string {
  const name = process.env.EVALS_GATEWAY || ("gateway" in harnesses[harness] ? harnesses[harness].gateway : undefined)
  if (!name) throw new Error(`${harnesses[harness].label} has no default gateway. Set EVALS_GATEWAY in cli/.env.`)
  return name
}

function gateway(harness: Harness) {
  const name = gatewayName(harness)
  if (!Object.hasOwn(presets, name)) throw new Error(`EVALS_GATEWAY=${name} is not one of ${Object.keys(presets).join(", ")}.`)
  const value = presets[name as keyof typeof presets]()
  // The harness's route: its own id for Codex and Claude Code, `openai-compatible` for OpenCode, Pi and Kimi Code.
  if (!aiGatewayHarnessRoute(normalizeAiGateway(value), harness)) throw new Error(`The ${name} gateway doesn't serve ${harnesses[harness].label}. Set EVALS_GATEWAY to one that serves it, such as cliproxy or openrouter.`)
  return { name, value }
}

async function route(harness: Harness) {
  const { name, value } = gateway(harness)
  return { name, ...await resolveAiGatewayRoute(normalizeAiGateway(value), harness, {}) }
}

/** A driver harness's gateway, or nothing for one that signs in to its own service. */
export function driverGateway(harness: Harness): { name: string, value: ReturnType<(typeof presets)[keyof typeof presets]> } | undefined {
  return gatewayServes(harness) ? gateway(harness) : undefined
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
