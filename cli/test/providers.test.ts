// Where model calls go: Anthropic and OpenAI by default, or one ViteHub AI gateway named by EVALS_GATEWAY.
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { claudeCodeEnv, codexProvider } from "../lib/providers.ts"

const names = ["EVALS_GATEWAY", "CLIPROXY_URL", "CLIPROXY_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"]
const saved = Object.fromEntries(names.map(name => [name, process.env[name]]))

function use(env: Record<string, string>) {
  for (const name of names) delete process.env[name]
  Object.assign(process.env, env)
}

afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name]
    else process.env[name] = saved[name]
  }
})

test("by default Claude Code uses the Anthropic key and Codex the OpenAI key", async () => {
  use({ ANTHROPIC_API_KEY: "ant", OPENAI_API_KEY: "oai" })
  assert.deepEqual(await claudeCodeEnv(), { ANTHROPIC_BASE_URL: "https://api.anthropic.com", ANTHROPIC_API_KEY: "ant" })
  const codex = await codexProvider()
  assert.ok(codex.config.includes(`model_provider="openai-api"`))
  assert.ok(codex.config.includes(`model_providers.openai-api.base_url="https://api.openai.com/v1"`))
  assert.deepEqual(codex.env, { EVALS_GATEWAY_KEY: "oai" })
})

test("EVALS_GATEWAY sends both harnesses through one gateway, with a bearer token", async () => {
  use({ EVALS_GATEWAY: "cliproxy", CLIPROXY_URL: "http://127.0.0.1:8317", CLIPROXY_API_KEY: "proxy", ANTHROPIC_API_KEY: "ant" })
  assert.deepEqual(await claudeCodeEnv(), { ANTHROPIC_BASE_URL: "http://127.0.0.1:8317", ANTHROPIC_AUTH_TOKEN: "proxy", ANTHROPIC_API_KEY: "" })
  const codex = await codexProvider()
  assert.ok(codex.config.includes(`model_providers.cliproxy.base_url="http://127.0.0.1:8317/v1"`))
  assert.deepEqual(codex.env, { EVALS_GATEWAY_KEY: "proxy" })
})

test("a missing key, an unknown gateway, or one that can't serve a harness says what to set", async () => {
  use({})
  await assert.rejects(claudeCodeEnv(), /ANTHROPIC_API_KEY/)
  await assert.rejects(codexProvider(), /OPENAI_API_KEY/)
  use({ EVALS_GATEWAY: "nope" })
  await assert.rejects(claudeCodeEnv(), /not one of/)
  use({ EVALS_GATEWAY: "anthropic", ANTHROPIC_API_KEY: "ant" })
  await assert.rejects(codexProvider(), /doesn't serve Codex/)
})
