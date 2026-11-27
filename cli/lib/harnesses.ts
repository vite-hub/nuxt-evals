// The harnesses the CLI runs, one entry each: what the rest of the CLI looks up instead of branching on the id.
// Its label, lab and chart tone come from the site's table (site/shared/harnesses.ts), which a new harness joins first.
// The ids are the harness ids of `@vite-hub/agent`'s provider profiles and `aiGatewayHarnessRoutes`
// (test/harnesses.test.ts fails when they differ).
// Codex and Claude Code start with the flags every published run used (agents.ts). Every other harness starts through
// its `@vite-hub/agent` driver (drivers.ts).
import { join } from "node:path"
import { type HarnessId, harnessInfo, type HarnessInfo } from "../../site/shared/harnesses.ts"

/** A harness the CLI spawns itself. */
export interface SpawnHarness extends HarnessInfo {
  launch: "spawn"
  /** The `modelSet` agent (agents.ts) a run gets with `--harness` and no `--agent`. Indexing it there checks the name. */
  defaultAgent: string
  /** The `@vite-hub/gateways` preset its model calls go to without EVALS_GATEWAY (providers.ts). */
  gateway: string
  /** The CLI in `cli/node_modules/.bin`. */
  bin: string
  /** Its config folder in the run's HOME, and the variable that points the CLI there. */
  configDir: string
  configEnv: string
  /** Where it writes session files and reads user skills, inside its config folder. */
  sessionsDir: string
  skillsDir: string
}

/** A harness that a `@vite-hub/agent` driver starts. Paths are relative to the run's HOME. */
export interface DriverHarness extends HarnessInfo {
  launch: "driver"
  /** The model a run gets without `--model`: an id of its default gateway. Without one, `--model` is required. */
  model?: string
  /** The gateway preset without EVALS_GATEWAY, for a harness that ViteHub can route through a gateway. */
  gateway?: string
  /** The CLI's command, looked up in `cli/.data/tools/bin` and then on PATH. */
  command: string
  /** How to put the command in `cli/.data/tools`. */
  install: string
  /** The variables it signs in with when no gateway serves it. They pass from cli/.env to the CLI. */
  authEnv: string[]
  /** The variable that moves its config folder, and that folder in the run's HOME. `gatewayOwned`: a gateway sets it. */
  home?: { env: string, path: string, gatewayOwned?: true }
  /** The user skills folder it reads. Without one, setups with skills can't run on it. */
  skillsDir?: string
  /**
   * A gateway gives it a private home in place of `home`, so ViteHub copies the skills of `skillsDir` there
   * (`agentWithSkills`, drivers.ts). Without a gateway, ViteHub can't hand it skills.
   */
  gatewaySkills?: true
}

export type HarnessSpec = SpawnHarness | DriverHarness

export const harnesses = {
  "codex": { ...harnessInfo.codex, launch: "spawn", defaultAgent: "sol", gateway: "openai", bin: "codex", configDir: ".codex", configEnv: "CODEX_HOME", sessionsDir: "sessions", skillsDir: "skills" },
  "claude-code": { ...harnessInfo["claude-code"], launch: "spawn", defaultAgent: "opus", gateway: "anthropic", bin: "claude", configDir: ".claude", configEnv: "CLAUDE_CONFIG_DIR", sessionsDir: "projects", skillsDir: "skills" },
  // Gemini CLI and Kimi Code read skills in the private home a gateway gives them. The run's skills wait in `skillsDir`
  // until the driver hands them to ViteHub.
  "gemini": { ...harnessInfo.gemini, launch: "driver", model: "gemini-3.8-flash", gateway: "google", command: "gemini", install: "npm install -g --prefix cli/.data/tools @google/gemini-cli", authEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], home: { env: "GEMINI_CLI_HOME", path: "", gatewayOwned: true }, skillsDir: ".gemini/skills", gatewaySkills: true },
  "antigravity": { ...harnessInfo.antigravity, launch: "driver", model: "gemini-3.8-flash", command: "agy", install: "Install the Antigravity CLI (agy) into cli/.data/tools/bin", authEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], home: { env: "GEMINI_HOME", path: ".gemini" } },
  // OpenCode reads skills from its config folder, which XDG_CONFIG_HOME puts in the run's HOME.
  "opencode": { ...harnessInfo.opencode, launch: "driver", model: "anthropic/claude-haiku-5.5", gateway: "openrouter", command: "opencode", install: "npm install -g --prefix cli/.data/tools opencode-ai", authEnv: [], home: { env: "OPENCODE_CONFIG_DIR", path: ".config/opencode" }, skillsDir: ".config/opencode/skills" },
  "cursor": { ...harnessInfo.cursor, launch: "driver", command: "cursor-agent", install: "Install the Cursor CLI (cursor-agent) into cli/.data/tools/bin", authEnv: ["CURSOR_API_KEY"], home: { env: "CURSOR_CONFIG_DIR", path: ".cursor" } },
  "grok": { ...harnessInfo.grok, launch: "driver", model: "grok-4.7", command: "grok", install: "npm install -g --prefix cli/.data/tools @xai-official/grok", authEnv: ["XAI_API_KEY"], home: { env: "GROK_HOME", path: ".grok" } },
  // With a gateway, ViteHub points PI_CODING_AGENT_DIR at its own models.json folder, so Pi reads skills from
  // ~/.agents/skills, which it also reads without one.
  "pi": { ...harnessInfo.pi, launch: "driver", model: "anthropic/claude-haiku-5.5", gateway: "openrouter", command: "pi", install: "npm install -g --prefix cli/.data/tools @earendil-works/pi-coding-agent", authEnv: [], home: { env: "PI_CODING_AGENT_DIR", path: ".pi/agent", gatewayOwned: true }, skillsDir: ".agents/skills" },
  "kimi": { ...harnessInfo.kimi, launch: "driver", model: "kimi-k3", gateway: "moonshot", command: "kimi", install: "npm install -g --prefix cli/.data/tools @moonshot-ai/kimi-code", authEnv: ["KIMI_MODEL_API_KEY"], home: { env: "KIMI_CODE_HOME", path: ".kimi-code", gatewayOwned: true }, skillsDir: ".kimi-code/skills", gatewaySkills: true },
  "kiro": { ...harnessInfo.kiro, launch: "driver", command: "kiro-cli", install: "Install the Kiro CLI (kiro-cli) into cli/.data/tools/bin", authEnv: ["KIRO_API_KEY"] },
  "fx": { ...harnessInfo.fx, launch: "driver", command: "fx", install: "Install the fx CLI into cli/.data/tools/bin", authEnv: [], home: { env: "FX_HOME", path: ".fx" } },
  "muse": { ...harnessInfo.muse, launch: "driver", command: "muse", install: "Install the muse CLI into cli/.data/tools/bin", authEnv: ["META_API_KEY"] },
  // Any agent of the ACP registry, named with --acp-agent. ViteHub installs it from the registry.
  "acp": { ...harnessInfo.acp, launch: "driver", command: "", install: "ViteHub installs the --acp-agent from the ACP registry", authEnv: [] },
} as const satisfies { [Id in HarnessId]: HarnessSpec }

export type Harness = keyof typeof harnesses

/** The harnesses the CLI spawns with its own flags: Codex and Claude Code. */
export type SpawnHarnessId = { [Id in Harness]: (typeof harnesses)[Id] extends { launch: "spawn" } ? Id : never }[Harness]

/** The harness `pnpm evals run` uses without `--harness` or `--agent`. */
export const defaultHarness: Harness = "codex"

export const harnessIds = Object.keys(harnesses) as Harness[]

export function isHarness(id: string): id is Harness {
  return Object.hasOwn(harnesses, id)
}

/** The id as a harness the CLI runs, or an error that lists them. */
export function toHarness(id: string): Harness {
  if (!isHarness(id)) throw new Error(`Unknown harness ${id}. Use ${harnessIds.join(", ")}.`)
  return id
}

export function isSpawnHarness(harness: Harness): harness is SpawnHarnessId {
  return harnesses[harness].launch === "spawn"
}

export function spec(harness: Harness): HarnessSpec {
  return harnesses[harness]
}

/** A spawned harness's folders inside a run's HOME. */
export function harnessHome(harness: SpawnHarnessId, home: string) {
  const entry = harnesses[harness]
  const config = join(home, entry.configDir)
  return { config, sessions: join(config, entry.sessionsDir), skills: join(config, entry.skillsDir) }
}

/** The user skills folder the harness reads inside a run's HOME, if it has one. */
export function harnessSkillsDir(harness: Harness, home: string): string | undefined {
  if (isSpawnHarness(harness)) return harnessHome(harness, home).skills
  const { skillsDir } = spec(harness) as DriverHarness
  return skillsDir ? join(home, skillsDir) : undefined
}
