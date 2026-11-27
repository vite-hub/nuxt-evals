// `pnpm evals hello --agent <harness>`: one short turn that shows a harness starts, reaches its model through the
// configured gateway, and can write and run in its folder. It runs in a fresh empty workspace and HOME, like a run,
// and is not an eval: no probes, no judge, nothing saved.
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { type AgentExit, type AgentLaunch, type AgentSettings, runAgentCli } from "./agents.ts"

export const helloPrompt = "Write a file named hello.txt containing the word hi, then run `cat hello.txt`."

export interface HelloResult {
  passed: boolean
  error?: string
}

/** Runs the hello turn. `runner` stands in for the agent in tests. */
export async function hello(settings: AgentSettings, options: { acpAgent?: string, timeoutMs?: number, runner?: (launch: AgentLaunch) => Promise<AgentExit> } = {}): Promise<HelloResult> {
  const work = await mkdtemp(join(tmpdir(), "hello-"))
  await mkdir(join(homedir(), ".cache/nuxt-evals"), { recursive: true })
  const home = await mkdtemp(join(homedir(), ".cache/nuxt-evals/home-"))
  try {
    const exit = await (options.runner ?? runAgentCli)({
      prompt: helloPrompt,
      work,
      home,
      settings,
      streamFile: join(home, "stream.jsonl"),
      sessionLog: join(home, "session.jsonl"),
      timeoutMs: options.timeoutMs ?? 5 * 60_000,
      ...options.acpAgent ? { acpAgent: options.acpAgent } : {},
    })
    const written = await readFile(join(work, "hello.txt"), "utf8").catch(() => undefined)
    if (exit.error) return { passed: false, error: exit.error }
    if (written?.toLowerCase().includes("hi")) return { passed: true }
    return { passed: false, error: written === undefined ? "The agent wrote no hello.txt." : `hello.txt holds ${JSON.stringify(written.slice(0, 80))}, not hi.` }
  }
  catch (error) {
    return { passed: false, error: error instanceof Error ? error.message : String(error) }
  }
  finally {
    await rm(work, { recursive: true, force: true })
    await rm(home, { recursive: true, force: true })
  }
}
