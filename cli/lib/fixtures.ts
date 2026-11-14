// Starting apps. A build project's starting files are tasks/<id>/fixture (or nothing). A fix or scan project plants its
// bugs into a shared base, such as tasks/meetups/base: the base plus the project's edits, written once per content hash
// to ~/.cache/nuxt-evals/fixtures/<id>-<hash>, so every run and the judge copy the same folder.
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, relative } from "node:path"
import { promisify } from "node:util"
import type { FixtureEdit, Task } from "../../tasks/types.ts"
import { tasks } from "./grade.ts"
import { tasksRoot } from "./paths.ts"

const cacheRoot = join(homedir(), ".cache/nuxt-evals/fixtures")
const exists = (path: string) => access(path).then(() => true, () => false)

async function listFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true })
  return entries.filter(entry => entry.isFile()).map(entry => relative(folder, join(entry.parentPath, entry.name))).sort()
}

/** Applies edits to a folder. A `find` that matches zero or several times is an error: the base changed under the plant. */
export async function applyEdits(folder: string, edits: FixtureEdit[]): Promise<void> {
  for (const edit of edits) {
    const file = join(folder, edit.path)
    if ("remove" in edit) {
      await rm(file)
      continue
    }
    if ("content" in edit) {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, edit.content)
      continue
    }
    const text = await readFile(file, "utf8")
    const count = text.split(edit.find).length - 1
    if (count !== 1) throw new Error(`${edit.path}: the plant's text matches ${count} times, not once:\n${edit.find.slice(0, 300)}`)
    await writeFile(file, text.replace(edit.find, () => edit.replace))
  }
}

async function folderHash(folder: string, extra: string): Promise<string> {
  const hash = createHash("sha256").update(extra)
  for (const path of await listFiles(folder)) hash.update(`${path}\0`).update(await readFile(join(folder, path))).update("\0")
  return hash.digest("hex").slice(0, 16)
}

/** The folder of a planted project's starting app, written on first use. */
async function plantedFixture(task: Task<unknown>): Promise<string> {
  const plant = task.plant!
  const base = join(tasksRoot, plant.base)
  const folder = join(cacheRoot, `${task.id}-${await folderHash(base, JSON.stringify(plant.edits))}`)
  if (await exists(folder)) return folder
  const temporary = `${folder}.tmp-${process.pid}`
  await rm(temporary, { recursive: true, force: true })
  await mkdir(dirname(temporary), { recursive: true })
  await cp(base, temporary, { recursive: true })
  await applyEdits(temporary, plant.edits)
  await rename(temporary, folder).catch(async (error: NodeJS.ErrnoException) => {
    await rm(temporary, { recursive: true, force: true })
    if (!await exists(folder)) throw error
  })
  return folder
}

/** The project's starting app, or undefined when the agent starts in an empty folder. */
export async function fixtureFolder(taskId: string): Promise<string | undefined> {
  const task = tasks[taskId]
  if (task?.plant) return await plantedFixture(task)
  const folder = join(tasksRoot, task?.fixture ?? join(taskId, "fixture"))
  return await exists(folder) ? folder : undefined
}

/**
 * The reference app the judge grades as the yardstick: `reference/`; for a planted project its clean base, or its
 * starting app with `plant.reference` on top.
 */
export async function referenceFolder(taskId: string): Promise<string> {
  const task = tasks[taskId]
  if (!task?.plant) return join(tasksRoot, taskId, "reference")
  if (!task.plant.reference) return join(tasksRoot, task.plant.base)
  const fixture = await plantedFixture(task)
  const folder = `${fixture}-reference-${createHash("sha256").update(JSON.stringify(task.plant.reference)).digest("hex").slice(0, 8)}`
  if (await exists(folder)) return folder
  const temporary = `${folder}.tmp-${process.pid}`
  await rm(temporary, { recursive: true, force: true })
  await cp(fixture, temporary, { recursive: true })
  await applyEdits(temporary, task.plant.reference)
  await rename(temporary, folder).catch(async (error: NodeJS.ErrnoException) => {
    await rm(temporary, { recursive: true, force: true })
    if (!await exists(folder)) throw error
  })
  return folder
}

/** The design pass's anchors, or undefined when the project has none. */
export async function vibeFile(taskId: string): Promise<string | undefined> {
  const file = join(tasksRoot, tasks[taskId]?.vibe ?? join(taskId, "VIBE.md"))
  return await exists(file) ? file : undefined
}

/** Projects that share a base or a fixture share one dependency install. */
export function dependencyKey(taskId: string): string {
  const task = tasks[taskId]
  const shared = task?.plant?.base ?? (task?.fixture ? dirname(task.fixture) : undefined)
  return shared?.replaceAll("/", "-") ?? taskId
}

/** The reference's change to the starting app, as a patch with `a/` and `b/` paths: a fix project's best fix. */
export async function bestFixDiff(taskId: string): Promise<string> {
  const from = (await fixtureFolder(taskId))!
  const to = await referenceFolder(taskId)
  const result = await promisify(execFile)("git", ["diff", "--no-index", "--no-color", "--", from, to], { maxBuffer: 16 * 1024 * 1024 }).catch((error: { code?: number, stdout?: string }) => {
    // git diff --no-index exits 1 when the folders differ.
    if (error.code === 1 && typeof error.stdout === "string") return { stdout: error.stdout }
    throw error
  })
  const strip = (path: string) => path.replace(/^\/+/, "")
  return result.stdout
    .replaceAll(`a/${strip(from)}/`, "a/").replaceAll(`b/${strip(to)}/`, "b/")
    .replaceAll(`a/${strip(to)}/`, "a/").replaceAll(`b/${strip(from)}/`, "b/")
}
