import { execFile } from "node:child_process"
import { cp, mkdir, readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { promisify } from "node:util"
import type { TaskFile } from "../../../tasks/types"

const exec = promisify(execFile)
const tasksRoot = resolve(process.cwd(), "../tasks")
const git = (cwd: string, ...args: string[]) => exec("git", ["-c", "user.name=nuxt-evals", "-c", "user.email=evals@onmax.me", ...args], { cwd, maxBuffer: 32 * 1024 * 1024 })

/** Copy the task fixture into a fresh Git working copy and commit it as the baseline. */
export async function prepareWorkingCopy(taskId: string, directory: string, home: string): Promise<void> {
  await mkdir(home, { recursive: true })
  await cp(join(tasksRoot, taskId, "fixture"), directory, { recursive: true })
  await git(directory, "init", "-q", "-b", "main")
  await git(directory, "add", "-A")
  await git(directory, "commit", "-q", "-m", "fixture")
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

const skipped = new Set([".git", "node_modules", ".nuxt", ".output"])

export async function readWorkingCopy(directory: string, root = directory): Promise<TaskFile[]> {
  const files: TaskFile[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await readWorkingCopy(path, root))
    else if (entry.isFile()) files.push({ path: relative(root, path), content: (await readFile(path, "utf8")).slice(0, 200_000) })
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}
