import { execFile } from "node:child_process"
import { access, appendFile, cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join, relative } from "node:path"
import { promisify } from "node:util"
import type { RunFile } from "../../site/shared/report.ts"
import { tasksRoot } from "./paths.ts"

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
export async function createSandbox(taskId: string): Promise<Sandbox> {
  const parent = await mkdtemp(join(tmpdir(), "run-"))
  await mkdir(join(homedir(), ".cache/nuxt-evals"), { recursive: true })
  const home = await mkdtemp(join(homedir(), ".cache/nuxt-evals/home-"))
  const work = join(parent, "project")
  const fixture = join(tasksRoot, taskId, "fixture")
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
      await rm(parent, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    },
  }
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

const skipped = new Set([".git", "node_modules", ".nuxt", ".output", ".data"])

export async function readWorkingCopy(directory: string, root = directory): Promise<RunFile[]> {
  const files: RunFile[] = []
  // A missing folder (a task without a fixture) has no files.
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (skipped.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await readWorkingCopy(path, root))
    else if (entry.isFile()) {
      const content = await readFile(path, "utf8")
      // Binary files (a SQLite database, an image) don't survive as text. The working copy keeps text only.
      if (!content.includes("\u0000")) files.push({ path: relative(root, path), content: content.slice(0, 200_000) })
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

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
