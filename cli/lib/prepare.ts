// Dependencies for task working copies. A fixture with a package.json is installed once per lockfile into
// ~/.cache/nuxt-evals/deps/<task>-<hash>/node_modules, and every working copy gets a plain copy of that folder.
// A copy takes seconds, needs no network and no pnpm store, and an agent that edits node_modules can't touch the cache.
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, relative } from "node:path"
import { promisify } from "node:util"
import { fixtureFolder, tasksRoot } from "./paths.ts"

/** What the install helpers need to know about a task. */
export type TaskFixture = { id: string, fixture?: string }

const exec = promisify(execFile)
const cacheRoot = join(homedir(), ".cache/nuxt-evals")
const manifests = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]

const exists = (path: string) => access(path).then(() => true, () => false)

async function manifestHash(directory: string): Promise<string> {
  const hash = createHash("sha256")
  for (const name of manifests) hash.update(`${name}\0${await readFile(join(directory, name), "utf8").catch(() => "")}\0`)
  return hash.digest("hex").slice(0, 16)
}

/** Runs a command through `heavy`, the shared machine lock, when it exists. It waits for a slot as long as it takes. */
export async function runHeavy(command: string[], options: { cwd: string, env?: NodeJS.ProcessEnv, timeoutMs?: number }): Promise<{ stdout: string, stderr: string }> {
  const heavy = await exec("sh", ["-c", "command -v heavy"]).then(result => result.stdout.trim(), () => "")
  const [file, ...args] = heavy ? [heavy, ...command] : command
  return await exec(file!, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env, HEAVY_WAIT: "0", HEAVY_MAX: String(Math.ceil((options.timeoutMs ?? 600_000) / 1000)) },
    // HEAVY_MAX limits the run itself. The queue can add up to 30 minutes on a busy machine.
    timeout: (options.timeoutMs ?? 600_000) + 1_800_000,
    maxBuffer: 64 * 1024 * 1024,
  })
}

/** Installs the fixture's dependencies into the cache once and returns the cached folder, or undefined when the fixture has no package.json. */
export async function fixtureDependencies(task: TaskFixture): Promise<string | undefined> {
  const fixture = fixtureFolder(task)
  if (!await exists(join(fixture, "package.json"))) return undefined
  // Named after the folder that holds the fixture (`meetups`, `vitehub-ui`), so tasks that share one share the install.
  const folder = join(cacheRoot, "deps", `${relative(tasksRoot, dirname(fixture)).replaceAll("/", "-")}-${await manifestHash(fixture)}`)
  if (await exists(join(folder, "node_modules/.modules.yaml"))) return folder
  const temporary = `${folder}.tmp-${process.pid}`
  await rm(temporary, { recursive: true, force: true })
  await mkdir(temporary, { recursive: true })
  for (const name of manifests) if (await exists(join(fixture, name))) await cp(join(fixture, name), join(temporary, name))
  // `copy` keeps the cached files independent of the pnpm store. Scripts run later, in each working copy.
  await runHeavy(["pnpm", "install", "--frozen-lockfile", "--ignore-scripts", "--config.package-import-method=copy"], { cwd: temporary, timeoutMs: 900_000 })
  await rename(temporary, folder).catch(async (error: NodeJS.ErrnoException) => {
    // Another run filled the cache first.
    await rm(temporary, { recursive: true, force: true })
    if (!await exists(join(folder, "node_modules/.modules.yaml"))) throw error
  })
  return folder
}

/**
 * Gives `directory` the dependencies of the task's fixture. Same manifests as the fixture: a copy of the cached install.
 * Changed manifests (the agent added a package): a normal `pnpm install`. Returns how it got them.
 */
export async function installDependencies(task: TaskFixture, directory: string): Promise<"none" | "cache" | "install"> {
  const cached = await fixtureDependencies(task)
  if (!cached) return "none"
  await rm(join(directory, "node_modules"), { recursive: true, force: true })
  if (await manifestHash(directory) === await manifestHash(fixtureFolder(task))) {
    await exec("cp", ["-a", "--reflink=auto", join(cached, "node_modules"), join(directory, "node_modules")])
    return "cache"
  }
  await runHeavy(["pnpm", "install", "--no-frozen-lockfile", "--ignore-scripts"], { cwd: directory, timeoutMs: 900_000 })
  return "install"
}

/**
 * Call after `createSandbox()` and before the agent starts. The agent gets a working copy with its dependencies
 * installed and the fixture's `postinstall` done (for Nuxt: `nuxt prepare`, so `.nuxt` types exist). The fixture's
 * `.gitignore` keeps node_modules and `.nuxt` out of the diff.
 *
 * `home` is the agent's HOME. The copied node_modules records the store it came from, and pnpm refuses to add a
 * package from another store (ERR_PNPM_UNEXPECTED_STORE). Pointing it at the store the agent's pnpm uses lets
 * `pnpm add` work and keeps the packages that are already there.
 */
export async function prepareWorkingCopy(task: TaskFixture, work: string, home: string): Promise<void> {
  if (await installDependencies(task, work) === "none") return
  const modulesFile = join(work, "node_modules/.modules.yaml")
  const modules = await readFile(modulesFile, "utf8")
  const store = join(home, process.platform === "darwin" ? "Library/pnpm/store" : ".local/share/pnpm/store", modules.match(/"storeDir": "[^"]*\/(v\d+)"/)?.[1] ?? "v11")
  await writeFile(modulesFile, modules.replace(/"storeDir": "[^"]*"/, `"storeDir": ${JSON.stringify(store)}`))
  const manifest = JSON.parse(await readFile(join(work, "package.json"), "utf8")) as { scripts?: Record<string, string> }
  // The script runs directly, as `pnpm run` would, without pnpm: pnpm would check the store against this HOME.
  const script = manifest.scripts?.postinstall
  if (script) await exec("sh", ["-c", script], { cwd: work, env: { ...process.env, PATH: `${join(work, "node_modules/.bin")}:${process.env.PATH}` }, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
}
