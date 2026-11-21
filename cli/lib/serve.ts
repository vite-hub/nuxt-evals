// Ports for the graders' production servers, and the playwright-core the graders drive Chromium with.
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
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
