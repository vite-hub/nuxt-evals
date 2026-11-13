import { execFile } from "node:child_process"
import { access, appendFile, cp, mkdir, mkdtemp, readdir, readFile, readlink, rm, stat } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join, relative } from "node:path"
import { isUtf8 } from "node:buffer"
import { promisify } from "node:util"
import type { RunFile } from "../../site/shared/report.ts"
import { fixtureFolder, tasksRoot } from "./paths.ts"

const exec = promisify(execFile)
const git = (cwd: string, ...args: string[]) => exec("git", ["-c", "user.name=nuxt-evals", "-c", "user.email=evals@onmax.me", ...args], { cwd, maxBuffer: 32 * 1024 * 1024 })

export interface Sandbox {
  /** The agent's working copy: the task fixture as one Git commit. */
  work: string
  /** An empty HOME for the agent CLI, so no host skills, plugins or config leak in. */
  home: string
  remove: () => Promise<void>
}

/**
 * The working copy and the HOME live in two separate folders, outside this repo and away from other runs, so
 * `find ..` from the working copy finds nothing else. The HOME is not under /tmp: Codex refuses to create its
 * `apply_patch` and sandbox helpers there, and the agent then has no `apply_patch`.
 */
export async function createSandbox(task: { id: string, fixture?: string }): Promise<Sandbox> {
  const parent = await mkdtemp(join(tmpdir(), "run-"))
  await mkdir(join(homedir(), ".cache/nuxt-evals"), { recursive: true })
  const home = await mkdtemp(join(homedir(), ".cache/nuxt-evals/home-"))
  const work = join(parent, "project")
  const fixture = fixtureFolder(task)
  // A task without a fixture starts in an empty folder.
  if (await access(fixture).then(() => true, () => false)) await cp(fixture, work, { recursive: true })
  else await mkdir(work, { recursive: true })
  await git(work, "init", "-q", "-b", "main")
  // Keeps installs and builds out of the diff even when the agent writes no .gitignore.
  await appendFile(join(work, ".git/info/exclude"), "node_modules/\n.nuxt/\n.output/\n.data/\n")
  await git(work, "add", "-A")
  await git(work, "commit", "-q", "--allow-empty", "-m", "Initial commit")
  return {
    work,
    home,
    remove: async () => {
      await stopProcessesIn([parent, home])
      await rm(parent, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    },
  }
}

/**
 * Stops every process whose working directory is inside one of `folders`. Agents leave `nuxt dev` running after they
 * exit (one held port 3000 for an hour), and a server still writing `.nuxt` makes removing the folder fail.
 */
export async function stopProcessesIn(folders: string[]): Promise<void> {
  const inside = (cwd: string) => folders.some(folder => cwd === folder || cwd.startsWith(`${folder}/`))
  const find = async () => {
    const pids: number[] = []
    for (const entry of await readdir("/proc").catch(() => [])) {
      if (!/^\d+$/.test(entry) || Number(entry) === process.pid) continue
      const cwd = await readlink(`/proc/${entry}/cwd`).catch(() => "")
      if (cwd && inside(cwd)) pids.push(Number(entry))
    }
    return pids
  }
  const signal = (pids: number[], name: NodeJS.Signals) => {
    for (const pid of pids) {
      try {
        process.kill(pid, name)
      }
      catch {}
    }
  }
  signal(await find(), "SIGTERM")
  await new Promise(resolve => setTimeout(resolve, 2000))
  signal(await find(), "SIGKILL")
}

export async function readPrompt(taskId: string): Promise<string> {
  return await readFile(join(tasksRoot, taskId, "PROMPT.md"), "utf8")
}

/** The diff against the fixture, including new files. */
export async function diffWorkingCopy(directory: string): Promise<string> {
  await git(directory, "add", "-A")
  const { stdout } = await git(directory, "diff", "--cached", "HEAD")
  return stdout
}

const skipped = new Set([".git", "node_modules", ".nuxt", ".output", ".data", "dist"])
/** Local databases are state, not source. */
const databaseFile = /\.(?:db|sqlite3?)(?:-wal|-shm|-journal)?$/
/** Larger files (videos, dumps) stay out of a run's files. */
const maxFileBytes = 32_000_000

export async function readWorkingCopy(directory: string, root = directory): Promise<RunFile[]> {
  const files: RunFile[] = []
  // A missing folder (a task without a fixture) has no files.
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (skipped.has(entry.name)) continue
    const path = join(directory, entry.name)
    // A symlink counts as what it points to: Meal planner's reference links its data/ to the fixture's, so the 19 MB of
    // recipes is in the repository once.
    const kind = entry.isSymbolicLink() ? await stat(path).catch(() => undefined) : entry
    if (kind?.isDirectory()) files.push(...await readWorkingCopy(path, root))
    else if (kind?.isFile()) {
      const bytes = await readFile(path)
      // Files are kept whole or not at all: a cut JSON file (Meal planner's 2.2 MB recipes) breaks the app it belongs to.
      if (bytes.length > maxFileBytes) continue
      if (isUtf8(bytes) && !bytes.includes(0)) files.push({ path: relative(root, path), content: bytes.toString("utf8") })
      // Images and fonts the app ships: without them a regrade can't build it.
      else if (!databaseFile.test(entry.name)) files.push({ path: relative(root, path), content: bytes.toString("base64"), encoding: "base64" })
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

/** The bytes to write for a saved file. */
export const fileBytes = (file: RunFile): string | Buffer => file.encoding === "base64" ? Buffer.from(file.content, "base64") : file.content

/** Text files only: what the site stores and what prompts quote. */
export const textFiles = (files: RunFile[]) => files.filter(file => file.encoding !== "base64")

/** Every `*.jsonl` file below `directory`, newest last. */
export async function findSessionFiles(directory: string): Promise<string[]> {
  const found: string[] = []
  const walk = async (path: string) => {
    for (const entry of await readdir(path, { withFileTypes: true }).catch(() => [])) {
      const next = join(path, entry.name)
      if (entry.isDirectory()) await walk(next)
      else if (entry.name.endsWith(".jsonl")) found.push(next)
    }
  }
  await walk(directory)
  return found.sort()
}

export async function ensureFolder(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}
