// Production servers for graders: the judge starts the app it graded once and hands scripted checks a way to start a
// second process of it; `evals admit` builds and starts a project's reference and starting app to prove its checks.
import { type ChildProcess, spawn } from "node:child_process"
import type { WriteStream } from "node:fs"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import type { ScriptedContext } from "../../tasks/types.ts"
import { cliRoot } from "./paths.ts"

/** Ports this process handed out. Judges of parallel runs ask at once, and each would find the same port still free. */
const taken = new Set<number>()

/** A free port in `from`-`to`. The search starts at a random port, so two CLI processes rarely race for the same one. */
export async function freePort(from: number, to: number): Promise<number> {
  const size = to - from + 1
  const start = Math.floor(Math.random() * size)
  for (let step = 0; step < size; step++) {
    const port = from + (start + step) % size
    if (taken.has(port)) continue
    const free = await new Promise<boolean>((resolve) => {
      const server = createServer().once("error", () => resolve(false)).listen(port, "127.0.0.1", () => server.close(() => resolve(true)))
    })
    if (free) {
      taken.add(port)
      return port
    }
  }
  throw new Error(`No free port in ${from}-${to}.`)
}

export function playwrightEntry(): string {
  const manifest = createRequire(join(cliRoot, "package.json")).resolve("playwright-core/package.json")
  return join(dirname(manifest), "index.mjs")
}

export interface Served {
  /** `http://localhost:<port>`: passkeys refuse an IP address as their domain. */
  origin: string
  port: number
  process: ChildProcess
  stop: () => Promise<void>
}

/** Starts `command` in `app` on `port` and waits up to a minute for it to answer. Undefined when it doesn't. */
export async function startServer(options: { app: string, command: string, env: Record<string, string>, port: number, log?: WriteStream }): Promise<Served | undefined> {
  const child = spawn("sh", ["-c", options.command], {
    cwd: options.app,
    env: { ...options.env, PORT: String(options.port), NITRO_PORT: String(options.port), HOST: "127.0.0.1", NITRO_HOST: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  })
  if (options.log) {
    child.stdout?.pipe(options.log, { end: false })
    child.stderr?.pipe(options.log, { end: false })
  }
  const stop = async () => {
    try {
      process.kill(-child.pid!, "SIGTERM")
    }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  let up = false
  for (let attempt = 0; attempt < 60 && !up && child.exitCode === null; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    up = await fetch(`http://127.0.0.1:${options.port}`, { redirect: "manual", signal: AbortSignal.timeout(5000) }).then(() => true, () => false)
  }
  if (!up) {
    await stop()
    return undefined
  }
  return { origin: `http://localhost:${options.port}`, port: options.port, process: child, stop }
}

/** The context a project's scripted checks run in, with `startAnother` for a second process of the same app. */
export function scriptedContext(options: { served: Served, app: string, scratch: string, command: string, env: Record<string, string>, log: (line: string) => void, serverLog?: WriteStream }): { context: ScriptedContext, stopAll: () => Promise<void> } {
  const others: Served[] = []
  const context: ScriptedContext = {
    origin: options.served.origin,
    app: options.app,
    scratch: options.scratch,
    log: options.log,
    importPlaywright: () => import(playwrightEntry()),
    startAnother: async () => {
      const port = await freePort(options.served.port + 1, 4899)
      const other = await startServer({ app: options.app, command: options.command, env: options.env, port, ...(options.serverLog ? { log: options.serverLog } : {}) })
      if (!other) throw new Error("The second server did not start.")
      others.push(other)
      return { origin: other.origin, stop: other.stop }
    },
  }
  return { context, stopAll: async () => { for (const other of others) await other.stop() } }
}
