import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { Harness } from "../../site/shared/report.ts"
import { cliRoot } from "./paths.ts"
import { findSessionFiles } from "./workspace.ts"

export interface AgentSettings {
  harness: Harness
  model: string
  /** Codex: `model_reasoning_effort`. Claude Code: `--effort`. */
  reasoning: string
}

export const defaultSettings: Record<Harness, AgentSettings> = {
  "codex": { harness: "codex", model: "gpt-6-luna", reasoning: "low" },
  "claude-code": { harness: "claude-code", model: "claude-opus-5-5", reasoning: "low" },
}

export interface AgentLaunch {
  prompt: string
  work: string
  home: string
  settings: AgentSettings
  /** Where the CLI's stdout goes (`--json` / `stream-json` events). */
  streamFile: string
  /** The port the agent's dev server should use. Parallel runs get different ones. */
  port?: number
  timeoutMs?: number
}

export interface AgentExit {
  code: number | null
  error?: string
  /** The session file the agent CLI wrote. */
  sessionFile?: string
}

function gateway() {
  const url = process.env.CLIPROXY_URL?.replace(/\/+$/, "").replace(/\/v1$/, "")
  const key = process.env.CLIPROXY_API_KEY
  if (!url || !key) throw new Error("Set CLIPROXY_URL and CLIPROXY_API_KEY in cli/.env.")
  return { url, key }
}

function command(launch: AgentLaunch): { bin: string, args: string[], env: Record<string, string> } {
  const { url, key } = gateway()
  // A minimal PATH: `pnpm evals` adds this repo's node_modules/.bin folders, which would show the agent the eval.
  const path = [dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"].join(":")
  // COREPACK_HOME: the empty HOME would make corepack download pnpm again on the agent's first call (about 80 s).
  // PORT: `nuxt dev` would otherwise take 3000, which other services on this machine use.
  const base = { PATH: path, HOME: launch.home, LANG: "C.UTF-8", TERM: "dumb", COREPACK_HOME: join(homedir(), ".cache/node/corepack"), PORT: String(launch.port ?? 4900) }
  const { settings } = launch
  if (settings.harness === "codex") {
    return {
      bin: join(cliRoot, "node_modules/.bin/codex"),
      args: [
        "exec", "--json", "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", launch.work,
        "-m", settings.model,
        "-c", `model_reasoning_effort=${JSON.stringify(settings.reasoning)}`,
        "-c", `model_reasoning_summary="detailed"`,
        "-c", `model_provider="cliproxy"`,
        "-c", `model_providers.cliproxy.name="CLIProxy"`,
        "-c", `model_providers.cliproxy.base_url=${JSON.stringify(`${url}/v1`)}`,
        "-c", `model_providers.cliproxy.wire_api="responses"`,
        "-c", `model_providers.cliproxy.env_key="CLIPROXY_API_KEY"`,
        // The sandbox only writes the working copy by default, so pnpm can't create its cache in HOME and `pnpm build`
        // fails. It also blocks the network, which stops web search, installs and a local server. The web is open in
        // every setup (plan-v2), so the sandbox allows both; the HOME is the run's own empty folder.
        "-c", `sandbox_workspace_write.writable_roots=[${JSON.stringify(launch.home)}]`,
        "-c", "sandbox_workspace_write.network_access=true",
        // Setup A is bare Codex: no curated plugins (their skills leaked in v0), no apps, no browser or computer use.
        ...["plugins", "remote_plugin", "apps", "browser_use", "computer_use", "image_generation"].flatMap(feature => ["--disable", feature]),
        launch.prompt,
      ],
      env: { ...base, CODEX_HOME: join(launch.home, ".codex"), CLIPROXY_API_KEY: key },
    }
  }
  return {
    bin: join(cliRoot, "node_modules/.bin/claude"),
    args: [
      "-p", launch.prompt,
      "--output-format", "stream-json", "--verbose",
      "--model", settings.model,
      "--effort", settings.reasoning,
      // Without it the transcript keeps only signed, empty thinking blocks.
      "--settings", JSON.stringify({ showThinkingSummaries: true }),
      "--permission-mode", "acceptEdits",
      "--allowedTools", "Bash,Read,Edit,MultiEdit,Write,Glob,Grep,WebSearch,WebFetch,TodoWrite",
    ],
    env: {
      ...base,
      CLAUDE_CONFIG_DIR: join(launch.home, ".claude"),
      ANTHROPIC_BASE_URL: url,
      ANTHROPIC_AUTH_TOKEN: key,
      ANTHROPIC_API_KEY: "",
      DISABLE_AUTOUPDATER: "1",
      DISABLE_TELEMETRY: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
  }
}

/** Run the agent CLI once in the sandbox. Resolves when it exits; never throws for a failed run. */
export async function runAgentCli(launch: AgentLaunch): Promise<AgentExit> {
  const { bin, args, env } = command(launch)
  if (launch.settings.harness === "codex") await mkdir(env.CODEX_HOME!, { recursive: true })
  const out = createWriteStream(launch.streamFile)
  const child = spawn(bin, args, { cwd: launch.work, env, stdio: ["ignore", "pipe", "pipe"] })
  child.stdout.pipe(out)
  let stderr = ""
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-8000)
  })
  const timeout = setTimeout(() => child.kill("SIGTERM"), launch.timeoutMs ?? 20 * 60_000)
  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve)
    child.on("error", (error) => {
      stderr += `\n${error.message}`
      resolve(null)
    })
  })
  clearTimeout(timeout)
  await new Promise(resolve => out.end(resolve))
  const sessionRoot = launch.settings.harness === "codex" ? join(launch.home, ".codex/sessions") : join(launch.home, ".claude/projects")
  const sessionFile = (await findSessionFiles(sessionRoot)).at(-1)
  return { code, sessionFile, ...(code === 0 ? {} : { error: stderr.trim().split("\n").slice(-5).join("\n") || `Exited with code ${code}.` }) }
}
