// Builds the agent's Acme Console app in a verifier copy, starts the production server, and gives probes HTTP and
// browser helpers. Every ViteHub UI task uses it. The agent never sees this file or the probes.
import { type ChildProcess, spawn } from "node:child_process"
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import type { Browser, BrowserContextOptions, Page } from "playwright-core"
import { installDependencies, runHeavy, type TaskFixture } from "../../cli/lib/prepare.ts"
import type { StartedTask } from "../types.ts"

/** The folder every ViteHub UI task starts from. */
export const fixture = "vitehub-ui/fixture"

export interface PageLog {
  /** Uncaught errors, console errors and Vue warnings (hydration mismatches among them). */
  errors: string[]
}

export interface UiRuntime {
  origin: string
  timings: Record<string, number>
  /** Every page error so far, from every page any probe opened. The `no-page-errors` probe runs last and reads it. */
  errors: string[]
  /** GETs a path of the app and parses JSON. Undefined for a non-2xx answer. */
  json: <T>(path: string) => Promise<T | undefined>
  status: (path: string) => Promise<number>
  /** Opens `path` in a fresh browser context, waits until Vue hydrated, runs `run`, and closes the context. */
  withPage: <T>(path: string, run: (page: Page, log: PageLog) => Promise<T>, options?: BrowserContextOptions) => Promise<T>
  /** Runs a shared scenario once per grading and caches its result for every probe that reads it. */
  once: <T>(name: string, run: () => Promise<T>) => Promise<T>
}

const skipped = new Set(["node_modules", ".nuxt", ".output", ".git", ".data", ".vitehub", ".cache"])

/** playwright-core is a cli dependency. Tasks resolve it from there, since pnpm doesn't hoist it to the repo root. */
async function loadChromium(): Promise<typeof import("playwright-core").chromium> {
  const manifest = createRequire(join(import.meta.dirname, "../../cli/package.json")).resolve("playwright-core/package.json")
  const module = await import(pathToFileURL(join(dirname(manifest), "index.mjs")).href) as typeof import("playwright-core")
  return module.chromium
}

/** A free port in [from, to] on 127.0.0.1. Never 3000. */
async function freePort(from: number, to: number): Promise<number> {
  for (let port = from; port <= to; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const server = createServer().once("error", () => resolve(false)).listen(port, "127.0.0.1", () => server.close(() => resolve(true)))
    })
    if (free) return port
  }
  throw new Error(`No free port in ${from}-${to}.`)
}

async function waitForServer(origin: string, server: ChildProcess, output: () => string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`The server exited with ${server.exitCode}: ${output().slice(-800)}`)
    const ok = await fetch(origin, { redirect: "manual", signal: AbortSignal.timeout(2000) }).then(() => true, () => false)
    if (ok) return
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`The server did not answer within ${timeoutMs / 1000} s: ${output().slice(-800)}`)
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolve => child.once("exit", resolve))
  child.kill("SIGTERM")
  const timer = setTimeout(() => child.kill("SIGKILL"), 3000)
  await exited
  clearTimeout(timer)
}

function tail(error: unknown): string {
  const record = error as { stderr?: string, stdout?: string, message?: string }
  const text = `${record.stdout ?? ""}\n${record.stderr ?? ""}\n${record.message ?? String(error)}`
  // The first error line says what broke; the stack after it says little.
  const start = text.search(/ERROR|Error:/)
  return (start === -1 ? text.slice(-800) : text.slice(start, start + 800)).replace(/\s+/g, " ").trim()
}

/** Waits until Nuxt mounted and hydrated the page, so clicks and keys reach Vue's handlers. */
async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const app = (document.querySelector("#__nuxt") as { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } } | null)?.__vue_app__
    return Boolean(app) && app?.$nuxt?.isHydrating !== true
  }, undefined, { timeout: 20_000 })
}

export async function startApp(work: string, task: TaskFixture): Promise<StartedTask<UiRuntime>> {
  const timings: Record<string, number> = {}
  const time = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    const started = performance.now()
    try {
      return await run()
    }
    finally {
      timings[name] = Math.round(performance.now() - started)
    }
  }

  const root = join(homedir(), ".cache/nuxt-evals/verify")
  await mkdir(root, { recursive: true })
  const dir = await mkdtemp(join(root, `${task.id}-`))
  // The verifier copy: the agent's files without installs, builds and env files.
  await cp(work, dir, { recursive: true, filter: source => !skipped.has(basename(source)) && !basename(source).startsWith(".env") })

  let server: ChildProcess | undefined
  let browser: Browser | undefined
  let output = ""
  const scenarios = new Map<string, Promise<unknown>>()
  const runtime: UiRuntime = {
    origin: "",
    timings,
    errors: [],
    json: async <T>(path: string) => {
      const response = await fetch(new URL(path, runtime.origin), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) })
      return response.ok ? await response.json() as T : undefined
    },
    status: async path => (await fetch(new URL(path, runtime.origin), { redirect: "manual", signal: AbortSignal.timeout(20_000) })).status,
    withPage: async (path, run, options = {}) => {
      browser ??= await (await loadChromium()).launch({ headless: true })
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options })
      const page = await context.newPage()
      page.setDefaultTimeout(10_000)
      const log: PageLog = { errors: [] }
      const record = (error: string) => {
        log.errors.push(error)
        runtime.errors.push(`${path}: ${error}`)
      }
      page.on("pageerror", error => record(`page error: ${error.message}`))
      page.on("console", (message) => {
        // A 400 or 409 the probes cause on purpose logs "Failed to load resource". That is the browser, not the app.
        if (message.type() === "error" && !/Failed to load resource/.test(message.text())) record(`error: ${message.text().slice(0, 300)}`)
        if (message.type() === "warning" && /\[Vue warn\]|[Hh]ydration/.test(message.text())) record(`warning: ${message.text().slice(0, 300)}`)
      })
      try {
        await page.goto(new URL(path, runtime.origin).href, { waitUntil: "load" })
        await hydrated(page)
        return await run(page, log)
      }
      finally {
        await context.close()
      }
    },
    once: (name, run) => {
      if (!scenarios.has(name)) scenarios.set(name, run())
      return scenarios.get(name) as ReturnType<typeof run>
    },
  }

  const stop = async () => {
    await browser?.close().catch(() => {})
    if (server) await stopProcess(server)
    if (process.env.NUXT_EVALS_KEEP_VERIFY !== "1") await rm(dir, { recursive: true, force: true })
  }

  // A failed build or start throws: the grader then fails every gate and runtime probe with this message.
  try {
    await time("install", () => installDependencies(task, dir))
    await time("build", () => runHeavy(["node_modules/.bin/nuxt", "build"], { cwd: dir, env: { NUXT_TELEMETRY_DISABLED: "1", CI: "1" }, timeoutMs: 600_000 }))
      .catch((error: unknown) => { throw new Error(`nuxt build failed: ${tail(error)}`) })
    const port = await freePort(4810, 4889)
    runtime.origin = `http://127.0.0.1:${port}`
    await time("start", async () => {
      server = spawn(process.execPath, [".output/server/index.mjs"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", TZ: "UTC", HOST: "127.0.0.1", PORT: String(port) },
      })
      server.stdout?.on("data", (chunk: Buffer) => { output = (output + chunk.toString()).slice(-20_000) })
      server.stderr?.on("data", (chunk: Buffer) => { output = (output + chunk.toString()).slice(-20_000) })
      await waitForServer(runtime.origin, server, () => output, 30_000)
    })
  }
  catch (error) {
    await stop()
    throw error instanceof Error && error.message.startsWith("nuxt build failed") ? error : new Error(tail(error))
  }
  return { runtime, stop }
}
