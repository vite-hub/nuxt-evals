// The app's data, in memory. It is seeded, so every start has the same projects, members and deployments.

export type Visibility = "private" | "public"
export type Role = "viewer" | "editor" | "admin"
export type DeploymentStatus = "ready" | "error" | "building" | "canceled"

export interface Project {
  slug: string
  name: string
  visibility: Visibility
  defaultBranch: string
  archived: boolean
  createdAt: string
}

export interface Member {
  id: string
  name: string
  email: string
  role: Role
}

export interface Deployment {
  id: string
  project: string
  branch: string
  status: DeploymentStatus
  author: string
  createdAt: string
  durationSeconds: number
}

export const branches = ["main", "develop", "release"] as const

const people = ["Ada Lovelace", "Grace Hopper", "Linus Torvalds", "Margaret Hamilton", "Ken Thompson", "Barbara Liskov"]
const featureBranches = ["main", "develop", "feat/sign-in", "fix/cache-headers", "feat/billing", "chore/deps"]
const statuses: DeploymentStatus[] = ["ready", "ready", "ready", "error", "building", "ready", "canceled"]
const day = "2026-11-01T12:00:00.000Z"

const projects = new Map<string, Project>([
  ["atlas", { slug: "atlas", name: "Atlas", visibility: "private", defaultBranch: "main", archived: false, createdAt: "2026-03-02T09:00:00.000Z" }],
  ["borealis", { slug: "borealis", name: "Borealis", visibility: "public", defaultBranch: "main", archived: false, createdAt: "2026-05-14T09:00:00.000Z" }],
  ["cosmos", { slug: "cosmos", name: "Cosmos", visibility: "private", defaultBranch: "develop", archived: false, createdAt: "2026-08-21T09:00:00.000Z" }],
])

const members = new Map<string, Member[]>([...projects.keys()].map((slug, index) => [
  slug,
  people.slice(index, index + 4).map((name, offset) => ({
    id: `${slug}-${offset + 1}`,
    name,
    email: `${name.split(" ")[0]!.toLowerCase()}@acme.test`,
    role: (["admin", "editor", "viewer", "viewer"] as const)[offset]!,
  })),
]))

/** 48 deployments, newest first. Durations are all different, so a sort by duration has one right order. */
const deployments: Deployment[] = Array.from({ length: 48 }, (_, index) => {
  const n = index + 1
  return {
    id: `dpl_${String(n).padStart(3, "0")}`,
    project: [...projects.keys()][n % 3]!,
    branch: featureBranches[(n * 5) % featureBranches.length]!,
    status: statuses[(n * 3) % statuses.length]!,
    author: people[(n * 7) % people.length]!,
    createdAt: new Date(Date.parse(day) - n * 97 * 60_000).toISOString(),
    durationSeconds: 20 + ((n * 37) % 401),
  }
})

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function listProjects(): Project[] {
  return [...projects.values()].filter(project => !project.archived)
}

export function getProject(slug: string): Project | undefined {
  return projects.get(slug)
}

export function createProject(input: { name: string, visibility: Visibility }): Project {
  const slug = slugify(input.name)
  const project: Project = { slug, name: input.name, visibility: input.visibility, defaultBranch: "main", archived: false, createdAt: new Date().toISOString() }
  projects.set(slug, project)
  members.set(slug, [])
  return project
}

export function updateProject(slug: string, patch: Partial<Pick<Project, "name" | "visibility" | "defaultBranch">>): Project | undefined {
  const project = projects.get(slug)
  if (!project) return undefined
  Object.assign(project, patch)
  return project
}

export function deleteProject(slug: string): boolean {
  members.delete(slug)
  return projects.delete(slug)
}

/** Archived projects leave the list but keep their data. */
export function archiveProject(slug: string): Project | undefined {
  const project = projects.get(slug)
  if (project) project.archived = true
  return project
}

export function listMembers(slug: string): Member[] | undefined {
  return members.get(slug)
}

export function listDeployments(): Deployment[] {
  return deployments
}
