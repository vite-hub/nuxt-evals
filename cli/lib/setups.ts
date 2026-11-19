// Setups. A: bare. B: the Nuxt MCP and the core Nuxt skill from nuxt-skill.onmax.me. C: the Nuxt MCP and a stack set
// of onmax/nuxt-skills installed as separate skills (`stackSkills`). V: for apps without Nuxt, the core Vue skills from
// onmax/nuxt-skills and no MCP server: the Nuxt MCP and the Nuxt skill have nothing to say about a Vue and Vite app.
// C and V come from one pinned nuxt-skills commit (`skillsCommit`).
// Skills are snapshots in this repository (`setups/`), so every run of a setup gets the same files.
// `pnpm evals skills` refreshes them.
import { createHash } from "node:crypto"
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join, relative } from "node:path"
import { type Harness, type Setup, setupIds } from "../../site/shared/report.ts"
import { repoRoot } from "./paths.ts"

export type { Setup }
export const setups: Setup[] = setupIds

export interface McpServer {
  name: string
  url: string
}

/** The official Nuxt MCP server (nuxt.com/docs/guide/ai/mcp). */
export const nuxtMcp: McpServer = { name: "nuxt", url: "https://nuxt.com/mcp" }

export interface SetupPlan {
  setup: Setup
  mcpServers: McpServer[]
  /** Folder with one subfolder per skill, copied into the agent's skills folder. */
  skillsDir?: string
  skills: string[]
  /** The task's own skill folders in the agent's HOME, after `installSetup`. */
  taskSkillsDirs?: string[]
}

export const setupsRoot = join(repoRoot, "setups")
const hostedSkill = "https://nuxt-skill.onmax.me/.well-known/skills"
const skillsRepo = "onmax/nuxt-skills"
/** The onmax/nuxt-skills commit C and V snapshot. Change it, then run `pnpm evals skills`. */
const skillsCommit = "16027afa8d76729e35a286016214d96d849e2ae3"
/** C: the skills for the Nuxt 5, Nitro, Vue, Pinia, Nuxt UI, VueUse and Vite stack the tasks use. */
const stackSkills = ["nuxt", "nitro", "vue", "vue-best-practices", "vue-router-best-practices", "pinia", "nuxt-ui", "vueuse-functions", "vite"]
/** V: the Vue, Vue Router and Composition API skills a Vue user picks from `npx skills add onmax/nuxt-skills`. */
const vueSkills = ["vue", "vue-best-practices", "vue-router-best-practices"]

const exists = (path: string) => access(path).then(() => true, () => false)

async function skillNames(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
}

function skillsFolder(setup: Setup): string {
  return join(setupsRoot, setup, "skills")
}

export async function planSetup(setup: Setup): Promise<SetupPlan> {
  if (setup === "A") return { setup, mcpServers: [], skills: [] }
  const skillsDir = skillsFolder(setup)
  const skills = await skillNames(skillsDir)
  if (!skills.length) throw new Error(`Setup ${setup} has no skills in ${relative(repoRoot, skillsDir)}. Run \`pnpm evals skills\`.`)
  return { setup, mcpServers: setup === "V" ? [] : [nuxtMcp], skillsDir, skills }
}

/** Where each harness reads user skills from, inside the run's own HOME. */
export function agentSkillsDir(harness: Harness, home: string): string {
  return harness === "codex" ? join(home, ".codex/skills") : join(home, ".claude/skills")
}

/**
 * Copies the setup's skills into the agent's HOME, then the task's own skill folders from the working copy (after the
 * install, since they can come from node_modules). The working copy stays the same in every setup. Returns the plan
 * with the task's skills added, so the agent gets them and the audit expects them.
 */
export async function installSetup(plan: SetupPlan, harness: Harness, home: string, work: string, taskSkills: string[] = []): Promise<SetupPlan> {
  if (!plan.skillsDir && !taskSkills.length) return plan
  const target = agentSkillsDir(harness, home)
  await mkdir(target, { recursive: true })
  if (plan.skillsDir) for (const skill of plan.skills) await cp(join(plan.skillsDir, skill), join(target, skill), { recursive: true })
  const folders = taskSkills.map(skill => join(target, basename(skill)))
  for (const [index, skill] of taskSkills.entries()) await cp(join(work, skill), folders[index]!, { recursive: true })
  return { ...plan, skills: [...plan.skills, ...folders.map(folder => basename(folder))], taskSkillsDirs: folders }
}

async function hashFolder(folder: string): Promise<string> {
  const hash = createHash("sha256")
  const walk = async (current: string) => {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await walk(path)
      else hash.update(`${relative(folder, path)}\0`).update(await readFile(path)).update("\0")
    }
  }
  await walk(folder)
  return hash.digest("hex").slice(0, 16)
}

/** B: the hosted core skill, as `npx skills add https://nuxt-skill.onmax.me/` installs it. */
export async function snapshotHostedSkill(): Promise<string> {
  const index = await (await fetch(`${hostedSkill}/index.json`)).json() as { skills: { name: string, files: string[] }[] }
  const target = skillsFolder("B")
  await rm(target, { recursive: true, force: true })
  for (const skill of index.skills) {
    for (const file of skill.files) {
      const response = await fetch(`${hostedSkill}/${skill.name}/${file}`)
      if (!response.ok) throw new Error(`${skill.name}/${file}: ${response.status}`)
      const path = join(target, skill.name, file)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, await response.text())
    }
  }
  return await hashFolder(target)
}

/** C and V: the named skills of onmax/nuxt-skills at `skillsCommit`, into `setups/<setup>/skills`. Returns the snapshot's hash. */
export async function snapshotRepoSkills(setup: Setup, skills: string[]): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${skillsRepo}/git/trees/${skillsCommit}?recursive=1`, { headers: { accept: "application/vnd.github+json" } })
  if (!response.ok) throw new Error(`GitHub tree ${skillsCommit}: ${response.status}`)
  const { tree } = await response.json() as { tree: { path: string, type: string }[] }
  const target = skillsFolder(setup)
  await rm(target, { recursive: true, force: true })
  for (const skill of skills) {
    const files = tree.filter(entry => entry.type === "blob" && entry.path.startsWith(`skills/${skill}/`))
    if (!files.some(file => file.path === `skills/${skill}/SKILL.md`)) throw new Error(`${skillsRepo} has no skill ${skill} at ${skillsCommit}`)
    for (const file of files) {
      const raw = await fetch(`https://raw.githubusercontent.com/${skillsRepo}/${skillsCommit}/${file.path}`)
      if (!raw.ok) throw new Error(`${file.path}: ${raw.status}`)
      const path = join(target, file.path.slice("skills/".length))
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, Buffer.from(await raw.arrayBuffer()))
    }
  }
  return await hashFolder(target)
}

/** Refreshes the skill snapshots of setups B, C and V and records where they came from. */
export async function refreshSkills(): Promise<void> {
  const sources = join(setupsRoot, "sources.json")
  const known = await exists(sources) ? JSON.parse(await readFile(sources, "utf8")) as Record<string, unknown> : {}
  const fetchedAt = new Date().toISOString()
  const b = await snapshotHostedSkill()
  console.log(`B: ${await skillNames(skillsFolder("B"))} from ${hostedSkill} (${b})`)
  known.B = { source: hostedSkill, hash: b, fetchedAt }
  for (const [setup, skills] of [["C", stackSkills], ["V", vueSkills]] as const) {
    const hash = await snapshotRepoSkills(setup, skills)
    console.log(`${setup}: ${skills} from ${skillsRepo}@${skillsCommit.slice(0, 7)} (${hash})`)
    known[setup] = { source: `https://github.com/${skillsRepo}/tree/${skillsCommit}/skills`, commit: skillsCommit, skills, hash, fetchedAt }
  }
  await writeFile(sources, `${JSON.stringify(Object.fromEntries(Object.entries(known).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`)
}

/** The hash of a setup's skill snapshot as it is now, so a run records the exact skills it got. */
export async function snapshotHash(plan: SetupPlan): Promise<string | undefined> {
  return plan.skillsDir ? await hashFolder(plan.skillsDir) : undefined
}

/** Every skill name in a skills folder, read from each SKILL.md's frontmatter, nested ones included. */
async function declaredSkills(folder: string): Promise<string[]> {
  const names: string[] = []
  const walk = async (current: string) => {
    for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.name === "SKILL.md") {
        const name = (await readFile(path, "utf8")).match(/^name:\s*["']?([\w:.-]+)["']?\s*$/m)?.[1]
        if (name) names.push(name)
      }
    }
  }
  await walk(folder)
  return [...new Set(names)].sort()
}

/** What the audit expects the agent to be offered in this setup. */
export async function auditExpectation(plan: SetupPlan, harness: Harness, home: string) {
  return {
    skills: [...(plan.skillsDir ? await declaredSkills(plan.skillsDir) : []), ...(await Promise.all((plan.taskSkillsDirs ?? []).map(declaredSkills))).flat()],
    required: plan.skills,
    mcpServers: plan.mcpServers.map(server => server.name),
    skillsDir: agentSkillsDir(harness, home),
  }
}
