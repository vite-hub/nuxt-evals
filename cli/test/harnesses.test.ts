// The harness table: it mirrors `@vite-hub/agent`'s harnesses, Codex and Claude Code keep the flags of every published
// run, every other harness gets its driver's options, and the setups a harness can't take say why.
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, test } from "node:test"
import { fileURLToPath } from "node:url"
import * as agent from "@vite-hub/agent"
import { aiGatewayHarnessRoutes } from "@vite-hub/gateways"
import { harnessColor, harnessLabel, skillPath } from "../../site/shared/harnesses.ts"
import { type AgentLaunch, modelSet, resolveSettings, spawnCommand } from "../lib/agents.ts"
import { type DriverHarnessId, driverOptions } from "../lib/drivers.ts"
import { type DriverHarness, harnesses, harnessHome, harnessIds, harnessSkillsDir, isSpawnHarness } from "../lib/harnesses.ts"
import { gatewayServes } from "../lib/providers.ts"
import { agentSkillsDir, checkSetup, type SetupPlan } from "../lib/setups.ts"

const names = ["EVALS_GATEWAY", "CLIPROXY_URL", "CLIPROXY_API_KEY", "CURSOR_API_KEY"]
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

const cliproxy = { EVALS_GATEWAY: "cliproxy", CLIPROXY_URL: "http://127.0.0.1:8317", CLIPROXY_API_KEY: "proxy" }

interface Profile {
  command: string
  home?: { env: string }
  signInOnly: boolean
  gateway?: { ownedEnv: string[] }
}

/** `@vite-hub/agent`'s provider profiles, which it doesn't export: the dist chunk that holds them. */
async function providerProfiles(): Promise<Record<string, Profile>> {
  const dist = dirname(fileURLToPath(import.meta.resolve("@vite-hub/agent")))
  const chunk = readdirSync(dist).find(name => /^provider-profiles-.*\.js$/.test(name))
  assert.ok(chunk, "No provider-profiles chunk in @vite-hub/agent's dist.")
  const module = await import(join(dist, chunk)) as Record<string, unknown>
  const profiles = Object.values(module).find(value => (value as Record<string, Profile> | undefined)?.codex?.command === "codex")
  assert.ok(profiles, "The provider-profiles chunk exports no profile table.")
  return profiles as Record<string, Profile>
}

test("the harness ids are @vite-hub/agent's, each with a driver, its command and its home variable", async () => {
  assert.deepEqual([...harnessIds].sort(), Object.keys(aiGatewayHarnessRoutes).sort())
  const profiles = await providerProfiles()
  assert.deepEqual([...harnessIds].sort(), Object.keys(profiles).sort())
  for (const id of harnessIds) {
    const profile = profiles[id]!
    if (isSpawnHarness(id)) {
      assert.equal(harnesses[id].bin, profile.command, id)
      assert.equal(harnesses[id].configEnv, profile.home?.env, id)
      continue
    }
    const entry = harnesses[id] as DriverHarness
    const factory = `${id.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())}Driver`
    assert.equal(typeof (agent as Record<string, unknown>)[factory], "function", `${factory} is not exported`)
    assert.equal(entry.command, profile.command, id)
    assert.equal(entry.home?.env, profile.home?.env, id)
    assert.equal(gatewayServes(id), !profile.signInOnly, `${id}: a gateway serves it`)
    assert.equal(entry.home?.gatewayOwned === true, profile.gateway?.ownedEnv.includes(profile.home?.env ?? "") === true, `${id}: the gateway owns its home`)
    if (!profile.signInOnly) assert.ok(entry.gateway, `${id} needs a default gateway`)
  }
})

test("each harness keeps its default agent, --agent takes a harness id, and an unknown one lists them", () => {
  assert.deepEqual(resolveSettings({}), modelSet.sol)
  assert.deepEqual(resolveSettings({ harness: "claude-code" }), modelSet.opus)
  assert.deepEqual(resolveSettings({ harness: "claude-code", model: "claude-fable-5-2" }), modelSet.fable)
  assert.deepEqual(resolveSettings({ agent: "opus" }), modelSet.opus)
  assert.deepEqual(resolveSettings({ agent: "gemini" }), { harness: "gemini", model: "gemini-3.8-flash", reasoning: "default" })
  assert.deepEqual(resolveSettings({ agent: "opencode", model: "claude-haiku-5-5" }), { harness: "opencode", model: "claude-haiku-5-5", reasoning: "default" })
  assert.throws(() => resolveSettings({ agent: "kiro" }), /Kiro has no default model here\. Pass --model\./)
  assert.throws(() => resolveSettings({ agent: "pi", reasoning: "high" }), /--reasoning is for Codex and Claude Code/)
  assert.throws(() => resolveSettings({ agent: "qwen" }), /Unknown agent qwen\. Use .*, or a harness: codex, claude-code, gemini/)
  assert.throws(() => resolveSettings({ harness: "qwen" }), /Unknown harness qwen\. Use codex, claude-code, gemini/)
})

test("sessions and skills stay in the folders each CLI reads", () => {
  assert.deepEqual(harnessHome("codex", "/h"), { config: "/h/.codex", sessions: "/h/.codex/sessions", skills: "/h/.codex/skills" })
  assert.deepEqual(harnessHome("claude-code", "/h"), { config: "/h/.claude", sessions: "/h/.claude/projects", skills: "/h/.claude/skills" })
  assert.equal(agentSkillsDir("claude-code", "/h"), "/h/.claude/skills")
  assert.equal(agentSkillsDir("gemini", "/h"), "/h/.gemini/skills")
  assert.equal(agentSkillsDir("opencode", "/h"), "/h/.config/opencode/skills")
  assert.equal(agentSkillsDir("pi", "/h"), "/h/.agents/skills")
  assert.equal(agentSkillsDir("kimi", "/h"), "/h/.agents/skills")
  assert.throws(() => agentSkillsDir("cursor", "/h"), /Cursor reads no user skills folder/)
  // The session viewer shows a read in any of them as a skill.
  for (const id of harnessIds) {
    const folder = harnessSkillsDir(id, "/h")
    if (folder) assert.ok(skillPath.test(`cat ${folder}/vue/references/props.md`), id)
  }
})

const plan = (setup: SetupPlan["setup"], extra: Partial<SetupPlan> = {}): SetupPlan => ({ setup, mcpServers: [], skills: [], ...extra })
const nuxtMcp = { name: "nuxt", url: "https://nuxt.com/mcp" }

test("MCP setups run on Codex and Claude Code only, and skills need a folder the harness reads", () => {
  use(cliproxy)
  for (const harness of ["codex", "claude-code"] as const) checkSetup(plan("B", { mcpServers: [nuxtMcp] }), harness)
  assert.throws(() => checkSetup(plan("B", { mcpServers: [nuxtMcp] }), "opencode"), /Setup B gives the agent the Nuxt MCP, which only Codex and Claude Code runs get\. Use setup A, V or VS with OpenCode\./)
  assert.throws(() => checkSetup(plan("CS", { mcpServers: [nuxtMcp], skills: ["nuxt"] }), "pi"), /Nuxt MCP/)
  checkSetup(plan("A"), "cursor")
  for (const harness of ["opencode", "pi", "kimi"] as const) checkSetup(plan("V", { skills: ["vue"] }), harness)
  assert.throws(() => checkSetup(plan("V", { skills: ["vue"] }), "grok"), /Grok reads no user skills folder, so it can't get the skills of setup V\./)
  // The gateway gives Gemini CLI a home of its own, so the run's skills folder is not the one it reads.
  assert.throws(() => checkSetup(plan("VS", { skills: ["vue"] }), "gemini"), /Gemini CLI reads skills from GEMINI_CLI_HOME, which the gateway points at its own folder/)
})

test("Codex and Claude Code start with the flags of every published run", async () => {
  use(cliproxy)
  const home = await mkdtemp(join(tmpdir(), "harness-test-"))
  try {
    const base = { prompt: "p", work: "/w", home, streamFile: join(home, "stream.jsonl") }
    const codex = await spawnCommand({ ...base, settings: { ...modelSet.sol, harness: "codex" } })
    assert.match(codex.bin, /node_modules\/\.bin\/codex$/)
    assert.deepEqual(codex.args.slice(0, 11), ["exec", "--json", "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", "/w", "-m", modelSet.sol.model, "-c", `model_reasoning_effort=${JSON.stringify(modelSet.sol.reasoning)}`])
    assert.ok(codex.args.includes("skills.bundled.enabled=false"))
    assert.ok(codex.args.includes(`model_providers.cliproxy.base_url="http://127.0.0.1:8317/v1"`))
    assert.equal(codex.args.at(-1), "-")
    assert.equal(codex.env.CODEX_HOME, join(home, ".codex"))
    const claude = await spawnCommand({ ...base, settings: { ...modelSet.opus, harness: "claude-code" } })
    assert.match(claude.bin, /node_modules\/\.bin\/claude$/)
    assert.deepEqual(claude.args.slice(0, 9), ["-p", "--output-format", "stream-json", "--verbose", "--model", modelSet.opus.model, "--effort", modelSet.opus.reasoning, "--settings"])
    assert.deepEqual(claude.args.slice(10), ["--permission-mode", "acceptEdits", "--allowedTools", "Bash,Read,Edit,MultiEdit,Write,Glob,Grep,WebSearch,WebFetch,TodoWrite", "--disable-slash-commands", "--strict-mcp-config"])
    assert.equal(claude.env.CLAUDE_CONFIG_DIR, join(home, ".claude"))
    assert.equal(claude.env.ANTHROPIC_BASE_URL, "http://127.0.0.1:8317")
  }
  finally {
    await rm(home, { recursive: true, force: true })
  }
})

/** What each driver harness's process gets besides HOME, PATH and the XDG folders, with EVALS_GATEWAY=cliproxy. */
const expected: Record<DriverHarnessId, { gateway: boolean, env: Record<string, string> }> = {
  gemini: { gateway: true, env: {} },
  antigravity: { gateway: false, env: { GEMINI_HOME: "/h/.gemini" } },
  opencode: { gateway: true, env: { OPENCODE_CONFIG_DIR: "/h/.config/opencode" } },
  cursor: { gateway: false, env: { CURSOR_CONFIG_DIR: "/h/.cursor", CURSOR_API_KEY: "cursor-key" } },
  grok: { gateway: false, env: { GROK_HOME: "/h/.grok" } },
  pi: { gateway: true, env: {} },
  kimi: { gateway: true, env: {} },
  kiro: { gateway: false, env: {} },
  fx: { gateway: false, env: { FX_HOME: "/h/.fx" } },
  muse: { gateway: false, env: {} },
  acp: { gateway: false, env: {} },
}

test("every other harness starts through its driver with the run's folders, the gateway or its own key", () => {
  use({ ...cliproxy, CURSOR_API_KEY: "cursor-key" })
  const run = { env: { HOME: "/h", PATH: "/bin" }, sessionLog: "/runs/x/session.jsonl", binaryPath: "/tools/bin/x" }
  for (const [harness, { gateway, env }] of Object.entries(expected) as [DriverHarnessId, (typeof expected)[DriverHarnessId]][]) {
    const launch: AgentLaunch = { prompt: "p", work: "/w", home: "/h", streamFile: "/runs/x/stream.jsonl", settings: { harness, model: "m", reasoning: "default" } }
    const options = driverOptions(launch, { ...run, ...harness === "acp" ? { acpAgent: "cline" } : {} })
    assert.equal(options.cwd, "/w", harness)
    assert.equal(options.model, "m", harness)
    assert.equal(options.permissions, "allow-all", harness)
    assert.equal(options.sessionLog, "/runs/x/session.jsonl", harness)
    assert.deepEqual(options.providerSettings, { binaryPath: "/tools/bin/x" }, harness)
    assert.equal(options.gateway?.name, gateway ? "cliproxy" : undefined, harness)
    assert.deepEqual(options.env, { HOME: "/h", PATH: "/bin", XDG_CONFIG_HOME: "/h/.config", XDG_DATA_HOME: "/h/.local/share", XDG_CACHE_HOME: "/h/.cache", XDG_STATE_HOME: "/h/.local/state", ...env }, harness)
  }
  const acp: AgentLaunch = { prompt: "p", work: "/w", home: "/h", streamFile: "/s", settings: { harness: "acp", model: "m", reasoning: "default" } }
  assert.equal(driverOptions(acp, { ...run, acpAgent: "cline" }).agentId, "cline")
  assert.throws(() => driverOptions(acp, run), /Name it with --acp-agent/)
})

test("the site names and colors a harness it can't run yet, and one it has never heard of", () => {
  assert.equal(harnessLabel("claude-code"), "Claude Code")
  assert.equal(harnessLabel("gemini"), "Gemini CLI")
  assert.equal(harnessLabel("qwen-code"), "Qwen Code")
  assert.equal(harnessColor("codex"), "var(--tone-codex, var(--tone-other))")
  assert.equal(harnessColor("qwen-code"), "var(--tone-other, var(--tone-other))")
})
