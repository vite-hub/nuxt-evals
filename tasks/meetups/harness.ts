// Builds the agent's Meetups app in a verifier copy, starts it next to the fake paid services, and gives probes
// HTTP and browser helpers. The agent never sees this file or the probes.
import { type ChildProcess, spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import type { Browser, BrowserContext, BrowserContextOptions, ConsoleMessage, Page, Request } from "playwright-core"
import { installDependencies, runHeavy } from "../../cli/lib/prepare.ts"
import type { StartedTask } from "../types.ts"
import { listEvents, type MeetupEvent } from "./fixture/server/data/events.ts"

interface FakeServices {
  url: string
  counts: { rates: number, rejected: number, mails: number }
  mails: { to: string, subject: string, text: string }[]
  ready: Promise<void>
  close: () => Promise<void>
}

export interface Reply {
  status: number
  headers: Headers
  text: string
  ms: number
}

export interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  /** Signs in as this demo user through the session cookie. */
  user?: "ada" | "grace" | "linus"
  /** Accept-Language header. */
  language?: string
}

export interface PageLog {
  /** Same-origin fetch and XHR calls the app made, without Nuxt's own assets and icons. */
  appRequests: Request[]
  console: ConsoleMessage[]
  pageErrors: Error[]
}

export interface MeetupsRuntime {
  ready: boolean
  failure?: string
  dir: string
  origin: string
  /** The rates key the build saw (from .env) and the one the server runs with. Only the second one works upstream. */
  keys: { build: string, run: string }
  services: FakeServices
  timings: Record<string, number>
  request: (path: string, options?: RequestOptions) => Promise<Reply>
  /** Opens a page in a fresh browser context and records what it does. Closes the context afterwards. */
  withPage: <T>(options: BrowserContextOptions, run: (page: Page, log: PageLog) => Promise<T>) => Promise<T>
  /** Runs a shared scenario once per grading and caches its result for every probe that reads it. */
  once: <T>(name: string, run: () => Promise<T>) => Promise<T>
}

const skipped = new Set(["node_modules", ".nuxt", ".output", ".git", ".data", ".cache"])
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
  return `${record.stderr ?? ""}\n${record.stdout ?? ""}\n${record.message ?? String(error)}`.trim().slice(-1500)
}

export async function startMeetups(work: string): Promise<StartedTask<MeetupsRuntime>> {
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
  const dir = await mkdtemp(join(root, "meetups-"))
  // The verifier copy: the agent's files without installs, builds and env files. Same as the fixture plus the diff.
  await cp(work, dir, { recursive: true, filter: source => !skipped.has(basename(source)) && !basename(source).startsWith(".env") })
  const keys = { build: `sk_build_${randomBytes(8).toString("hex")}`, run: `sk_live_${randomBytes(8).toString("hex")}` }

  const servicesModule = await import(pathToFileURL(join(import.meta.dirname, "fixture/services/fake-services.mjs")).href) as {
    startFakeServices: (options: { port: number, apiKey: string }) => FakeServices
  }
  const services = servicesModule.startFakeServices({ port: await freePort(4890, 4899), apiKey: keys.run })
  await services.ready

  let server: ChildProcess | undefined
  let browser: Browser | undefined
  let output = ""
  const scenarios = new Map<string, Promise<unknown>>()
  const runtime: MeetupsRuntime = {
    ready: false,
    dir,
    origin: "",
    keys,
    services,
    timings,
    request: async (path, options = {}) => {
      const headers: Record<string, string> = { "accept": "text/html,application/json;q=0.9,*/*;q=0.8", ...options.headers }
      if (options.user) headers.cookie = `meetups_session=${options.user}`
      if (options.language) headers["accept-language"] = options.language
      const started = performance.now()
      const response = await fetch(new URL(path, runtime.origin), { method: options.method ?? "GET", headers, body: options.body, redirect: "manual", signal: AbortSignal.timeout(20_000) })
      const text = await response.text()
      return { status: response.status, headers: response.headers, text, ms: performance.now() - started }
    },
    withPage: async (options, run) => {
      browser ??= await (await loadChromium()).launch({ headless: true })
      const context: BrowserContext = await browser.newContext(options)
      const page = await context.newPage()
      const origin = new URL(runtime.origin).origin
      const log: PageLog = { appRequests: [], console: [], pageErrors: [] }
      page.on("request", (request) => {
        const url = new URL(request.url())
        if (url.origin !== origin || !["fetch", "xhr"].includes(request.resourceType())) return
        if (url.pathname.startsWith("/_nuxt/") || url.pathname.startsWith("/api/_nuxt_icon")) return
        log.appRequests.push(request)
      })
      page.on("console", message => log.console.push(message))
      page.on("pageerror", error => log.pageErrors.push(error))
      try {
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
    await services.close()
    if (process.env.NUXT_EVALS_KEEP_VERIFY !== "1") await rm(dir, { recursive: true, force: true })
  }

  try {
    await time("install", () => installDependencies("meetups", dir))
    // A CI build has the production env. The key it sees must never reach the browser, and the server must use the key it gets at start.
    await writeFile(join(dir, ".env"), `NUXT_RATES_API_KEY=${keys.build}\n`)
    try {
      await time("build", () => runHeavy(["node_modules/.bin/nuxt", "build"], { cwd: dir, env: { NUXT_TELEMETRY_DISABLED: "1", CI: "1" }, timeoutMs: 600_000 }))
    }
    catch (error) {
      runtime.failure = `nuxt build failed: ${tail(error)}`
      return { runtime, stop }
    }
    await rm(join(dir, ".env"), { force: true })

    const port = await freePort(4810, 4889)
    runtime.origin = `http://127.0.0.1:${port}`
    await time("start", async () => {
      server = spawn(process.execPath, [".output/server/index.mjs"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NODE_ENV: "production",
          TZ: "UTC",
          HOST: "127.0.0.1",
          PORT: String(port),
          NUXT_RATES_API_URL: services.url,
          NUXT_RATES_API_KEY: keys.run,
          NUXT_MAILER_URL: services.url,
        },
      })
      server.stdout?.on("data", (chunk: Buffer) => { output = (output + chunk.toString()).slice(-20_000) })
      server.stderr?.on("data", (chunk: Buffer) => { output = (output + chunk.toString()).slice(-20_000) })
      await waitForServer(runtime.origin, server, () => output, 30_000)
    })
    runtime.ready = true
  }
  catch (error) {
    runtime.failure = tail(error)
  }
  return { runtime, stop }
}

/** Every text file the build serves to browsers. */
export async function publicAssets(dir: string): Promise<{ path: string, text: string }[]> {
  const found: { path: string, text: string }[] = []
  const walk = async (folder: string) => {
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
      const path = join(folder, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (/\.(m?js|css|html|json|txt|map)$/.test(entry.name)) found.push({ path, text: await readFile(path, "utf8") })
    }
  }
  await walk(join(dir, ".output/public"))
  return found
}

// What the app should show, from the same in-memory store the fixture ships. The store is seeded, so the grader and
// the server see the same events.
const pageSize = 20

export function upcoming(filter: { q?: string, city?: string } = {}, now = Date.now()): MeetupEvent[] {
  const needle = filter.q?.toLowerCase()
  return listEvents().filter(event => Date.parse(event.startsAt) > now
    && (!needle || event.title.toLowerCase().includes(needle))
    && (!filter.city || event.city === filter.city))
}

export function listPage(filter: { q?: string, city?: string, page?: number }): MeetupEvent[] {
  const page = filter.page ?? 1
  return upcoming(filter).slice((page - 1) * pageSize, page * pageSize)
}

/** An upcoming event at least a day away with a 20 euro ticket and many free seats, so time and RSVP probes are stable. */
export function sampleEvent(index = 0): MeetupEvent {
  const later = Date.now() + 24 * 60 * 60 * 1000
  const event = listEvents().filter(item => Date.parse(item.startsAt) > later && item.priceCents === 2000 && item.capacity > 120)[index]
  if (!event) throw new Error("The store has no sample event.")
  return event
}

/** Matches a title as a whole, so "Vue Meetup #12" doesn't match "Vue Meetup #120". */
export function hasTitle(text: string, title: string): boolean {
  return new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`).test(text)
}
