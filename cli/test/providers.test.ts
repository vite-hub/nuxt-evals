// Where model calls go: a CLIProxy when one is set, else each provider's own key.
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { claudeCodeEnv, codexProvider } from "../lib/providers.ts"

const names = ["CLIPROXY_URL", "CLIPROXY_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "OPENAI_API_KEY", "OPENAI_BASE_URL"]
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

test("a CLIProxy serves both harnesses and wins over keys", () => {
  use({ CLIPROXY_URL: "http://127.0.0.1:8317/v1/", CLIPROXY_API_KEY: "proxy", ANTHROPIC_API_KEY: "ant", OPENAI_API_KEY: "oai" })
  assert.deepEqual(claudeCodeEnv(), { ANTHROPIC_BASE_URL: "http://127.0.0.1:8317", ANTHROPIC_AUTH_TOKEN: "proxy", ANTHROPIC_API_KEY: "" })
  const codex = codexProvider()
  assert.ok(codex.config.includes(`model_providers.cliproxy.base_url="http://127.0.0.1:8317/v1"`))
  assert.deepEqual(codex.env, { CLIPROXY_API_KEY: "proxy" })
})

test("without a CLIProxy, each harness uses its provider's key and optional base URL", () => {
  use({ ANTHROPIC_API_KEY: "ant", OPENAI_API_KEY: "oai", OPENAI_BASE_URL: "https://router.example/v1/" })
  assert.deepEqual(claudeCodeEnv(), { ANTHROPIC_API_KEY: "ant" })
  const codex = codexProvider()
  assert.ok(codex.config.includes(`model_provider="openai-api"`))
  assert.ok(codex.config.includes(`model_providers.openai-api.base_url="https://router.example/v1"`))
  assert.ok(codex.config.includes(`model_providers.openai-api.env_key="OPENAI_API_KEY"`))
  assert.deepEqual(codex.env, { OPENAI_API_KEY: "oai" })
})

test("a missing key names what to set", () => {
  use({})
  assert.throws(() => claudeCodeEnv(), /ANTHROPIC_API_KEY/)
  assert.throws(() => codexProvider(), /OPENAI_API_KEY/)
})
