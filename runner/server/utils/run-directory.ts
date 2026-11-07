import { join, resolve } from "node:path"

/** Every run gets its own working copy and its own empty HOME, so no host skills or config leak in. */
export const runsRoot = resolve(process.cwd(), ".data/runs")

export function runDirectory(id: string): string {
  if (!/^[\w.-]+$/.test(id)) throw new Error(`Bad run id: ${id}`)
  return join(runsRoot, id, "work")
}

export function runHome(id: string): string {
  if (!/^[\w.-]+$/.test(id)) throw new Error(`Bad run id: ${id}`)
  return join(runsRoot, id, "home")
}
