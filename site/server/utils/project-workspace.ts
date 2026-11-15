import { useWorkspaceFiles } from "vite-hub/workspace/files"
import type { RunFile } from "../../shared/report"

/** Projects that have a Workspace in `server/workspaces/`. */
export const projectWorkspaces = new Set(["meetups", "meal-planner", "fix-seats-race", "fix-cache-leak", "fix-owner-check", "fix-cached-search", "fix-session-reads", "fix-svg-cover", "fix-api-token", "scan-meetups"])
const hiddenPath = /(?:^|\/)(?:\.git|\.vitehub|\.env(?:\..*)?)(?:\/|$)/

// SAFETY (both): callers check `projectWorkspaces` or a stored run first, and each name there has a Workspace definition.
export function projectWorkspace(project: string) {
  return useWorkspaceFiles(project as "meetups")
}

export function writableProjectWorkspace(project: string) {
  return useWorkspaceFiles(project as "meetups", { mode: "write" })
}

type ProjectHistory = Pick<ReturnType<typeof projectWorkspace>, "history">
type Revision = NonNullable<Awaited<ReturnType<ProjectHistory["history"]["head"]>>>

export function fileMap(files: RunFile[]): Record<string, string> {
  return Object.fromEntries(files.filter(file => !hiddenPath.test(file.path)).map(file => [file.path, file.content]))
}

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("")
}

/** The fingerprint of a set of starting files, stored as `metadata.fixture` on each `main` revision. */
export async function fixtureHash(files: Record<string, string>): Promise<string> {
  return await sha256(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))))
}

/** Every `main` revision, newest first. `main` gets a revision only when the starting app changes, so it stays short. */
export async function baseRevisions(workspace: ProjectHistory): Promise<Revision[]> {
  const revisions: Revision[] = []
  let cursor: string | undefined
  do {
    const page = await workspace.history.list({ limit: 100, ...(cursor ? { cursor } : {}) })
    revisions.push(...page.revisions)
    cursor = page.cursor
  } while (cursor)
  return revisions
}

/**
 * The `main` revision a run started from. New runs record it as `metadata.base`. Older runs get the newest `main`
 * revision committed before them, so a newer starting app does not change their diff.
 */
export async function runBase(workspace: ProjectHistory, run: Revision): Promise<Revision | undefined> {
  const revisions = await baseRevisions(workspace)
  const recorded = run.metadata?.base
  if (typeof recorded === "string") return revisions.find(revision => revision.id === recorded)
  return revisions.find(revision => revision.createdAt <= run.createdAt) ?? revisions.at(-1)
}

/** Files a preview needs. npm installs in the WebContainer, so the pnpm lockfile stays out. */
const previewSkip = new Set(["pnpm-lock.yaml"])

/** Every file of one revision, keyed by path, for the in-browser preview. */
export async function revisionFiles(workspace: ProjectHistory, revision: string): Promise<Record<string, string>> {
  const view = await workspace.history.open(revision)
  const entries = await view.list("", { recursive: true })
  const paths = entries.filter(entry => entry.type === "file").map(entry => entry.path.replace(/^\/+/, ""))
    .filter(path => !previewSkip.has(path) && !hiddenPath.test(path))
  const contents = await Promise.all(paths.map(path => view.readFile(path)))
  return Object.fromEntries(paths.map((path, index) => [path, contents[index]!]))
}
