// The harnesses the CLI runs, one entry each: what the rest of the CLI looks up instead of branching on the id.
// Its label, lab and chart tone come from the site's table (site/shared/harnesses.ts), which a new harness joins first.
// How each one is launched lives in agents.ts, which needs a launcher for every key here.
import { join } from "node:path"
import { type HarnessId, harnessInfo, type HarnessInfo } from "../../site/shared/harnesses.ts"

export interface HarnessSpec extends HarnessInfo {
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

export const harnesses = {
  "codex": { ...harnessInfo.codex, defaultAgent: "sol", gateway: "openai", bin: "codex", configDir: ".codex", configEnv: "CODEX_HOME", sessionsDir: "sessions", skillsDir: "skills" },
  "claude-code": { ...harnessInfo["claude-code"], defaultAgent: "opus", gateway: "anthropic", bin: "claude", configDir: ".claude", configEnv: "CLAUDE_CONFIG_DIR", sessionsDir: "projects", skillsDir: "skills" },
} as const satisfies { [Id in HarnessId]?: HarnessSpec }

export type Harness = keyof typeof harnesses

/** The harness `pnpm evals run` uses without `--harness` or `--agent`. */
export const defaultHarness: Harness = "codex"

export const harnessIds = Object.keys(harnesses) as Harness[]

/** The id as a harness the CLI runs, or an error that lists them. */
export function toHarness(id: string): Harness {
  if (!Object.hasOwn(harnesses, id)) throw new Error(`Unknown harness ${id}. Use ${harnessIds.join(" or ")}.`)
  return id as Harness
}

/** The harness's folders inside a run's HOME. */
export function harnessHome(harness: Harness, home: string) {
  const spec = harnesses[harness]
  const config = join(home, spec.configDir)
  return { config, sessions: join(config, spec.sessionsDir), skills: join(config, spec.skillsDir) }
}
