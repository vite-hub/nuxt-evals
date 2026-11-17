// Setups. A: bare. B: the Nuxt MCP and the core Nuxt skill from nuxt-skill.onmax.me. C: the Nuxt MCP and the skill
// nuxt-skill-hub generates for the project, which adds a skill for each installed module (Nuxt UI, VueUse, ...).
// V: for apps without Nuxt, the core Vue skills from onmax/nuxt-skills and no MCP server: the Nuxt MCP and the Nuxt
// skill have nothing to say about a Vue and Vite app.
// Skills are snapshots in this repository (`setups/`), so every run of a setup gets the same files.
// `pnpm evals skills <project>` refreshes them.
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join, relative } from "node:path"
import { promisify } from "node:util"
import { type Harness, type Setup, setupIds } from "../../site/shared/report.ts"
import { fixtureFolder } from "./fixtures.ts"
import { repoRoot } from "./paths.ts"
import { installDependencies, runHeavy } from "./prepare.ts"

const exec = promisify(execFile)

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
const skillHubVersion = "0.3.1"
const skillsRepo = "onmax/nuxt-skills"
/** V: the Vue, Vue Router and Composition API skills a Vue user picks from `npx skills add onmax/nuxt-skills`. */
const vueSkills = ["vue", "vue-best-practices", "vue-router-best-practices"]

const exists = (path: string) => access(path).then(() => true, () => false)

async function skillNames(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
}

function skillsFolder(setup: Setup, project: string): string {
  return setup === "C" ? join(setupsRoot, "C", project, "skills") : join(setupsRoot, setup, "skills")
}

export async function planSetup(setup: Setup, project: string): Promise<SetupPlan> {
  if (setup === "A") return { setup, mcpServers: [], skills: [] }
  const skillsDir = skillsFolder(setup, project)
  const skills = await skillNames(skillsDir)
  if (!skills.length) throw new Error(`Setup ${setup} has no skills in ${relative(repoRoot, skillsDir)}. Run \`pnpm evals skills ${project}\`.`)
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
  const target = skillsFolder("B", "")
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

/** V: the Vue skills at the current head of onmax/nuxt-skills. Returns the commit and the snapshot's hash. */
export async function snapshotVueSkills(): Promise<{ commit: string, hash: string }> {
  const github = async <T>(path: string) => {
    const response = await fetch(`https://api.github.com/repos/${skillsRepo}/${path}`, { headers: { accept: "application/vnd.github+json" } })
    if (!response.ok) throw new Error(`GitHub ${path}: ${response.status}`)
    return await response.json() as T
  }
  const { sha: commit } = await github<{ sha: string }>("commits/main")
  const { tree } = await github<{ tree: { path: string, type: string }[] }>(`git/trees/${commit}?recursive=1`)
  const target = skillsFolder("V", "")
  await rm(target, { recursive: true, force: true })
  for (const skill of vueSkills) {
    const files = tree.filter(entry => entry.type === "blob" && entry.path.startsWith(`skills/${skill}/`))
    if (!files.some(file => file.path === `skills/${skill}/SKILL.md`)) throw new Error(`${skillsRepo} has no skill ${skill} at ${commit}`)
    for (const file of files) {
      const response = await fetch(`https://raw.githubusercontent.com/${skillsRepo}/${commit}/${file.path}`)
      if (!response.ok) throw new Error(`${file.path}: ${response.status}`)
      const path = join(target, file.path.slice("skills/".length))
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, Buffer.from(await response.arrayBuffer()))
    }
  }
  return { commit, hash: await hashFolder(target) }
}

/**
 * C: what a project gets after `npx nuxi module add nuxt-skill-hub` and `nuxt prepare`. Generated in a scratch copy
 * of the fixture, so the fixture itself stays the same in every setup.
 */
export async function generateProjectSkill(project: string): Promise<string> {
  const fixture = await fixtureFolder(project)
  if (!fixture) throw new Error(`Project ${project} has no starting app, so nuxt-skill-hub has nothing to prepare.`)
  const scratch = join(homedir(), ".cache/nuxt-evals", `skill-hub-${project}-${process.pid}`)
  await rm(scratch, { recursive: true, force: true })
  await cp(fixture, scratch, { recursive: true, filter: source => !/node_modules|\.nuxt|\.output/.test(source) })
  try {
    await installDependencies(project, scratch)
    await runHeavy(["pnpm", "add", "-D", `nuxt-skill-hub@${skillHubVersion}`], { cwd: scratch, timeoutMs: 600_000 })
    const config = join(scratch, "nuxt.config.ts")
    const source = await readFile(config, "utf8")
    await writeFile(config, source.replace(/modules:\s*\[/, `modules: ["nuxt-skill-hub", `).replace(/\}\)\s*$/, `  skillHub: { targets: ["claude-code"] },\n})\n`))
    await mkdir(join(scratch, ".claude"), { recursive: true })
    const { stdout, stderr } = await exec("node_modules/.bin/nuxt", ["prepare"], { cwd: scratch, env: { ...process.env, CI: "", NUXT_TELEMETRY_DISABLED: "1" }, maxBuffer: 16 * 1024 * 1024 })
    const generated = join(scratch, ".claude/skills")
    const names = await skillNames(generated)
    if (!names.length) throw new Error(`nuxt-skill-hub wrote no skill.\n${stdout}\n${stderr}`.slice(-2000))
    const target = skillsFolder("C", project)
    await rm(target, { recursive: true, force: true })
    await mkdir(target, { recursive: true })
    for (const name of names) await cp(join(generated, name), join(target, name), { recursive: true, filter: path => !path.endsWith(".gitignore") })
    return await hashFolder(target)
  }
  finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

/**
 * Refreshes the skill snapshots of setups B, V and C and records where they came from. C needs a Nuxt starting app,
 * so a project without one (a Vue app built from an empty folder) refreshes B and V only.
 */
export async function refreshSkills(project: string): Promise<void> {
  const sources = join(setupsRoot, "sources.json")
  const known = await exists(sources) ? JSON.parse(await readFile(sources, "utf8")) as Record<string, unknown> : {}
  const fetchedAt = new Date().toISOString()
  const b = await snapshotHostedSkill()
  console.log(`B: ${await skillNames(skillsFolder("B", project))} from ${hostedSkill} (${b})`)
  known.B = { source: hostedSkill, hash: b, fetchedAt }
  const v = await snapshotVueSkills()
  console.log(`V: ${await skillNames(skillsFolder("V", project))} from ${skillsRepo}@${v.commit.slice(0, 7)} (${v.hash})`)
  known.V = { source: `https://github.com/${skillsRepo}/tree/${v.commit}/skills`, skills: vueSkills, hash: v.hash, fetchedAt }
  const fixture = await fixtureFolder(project)
  if (fixture && await exists(join(fixture, "nuxt.config.ts"))) {
    const c = await generateProjectSkill(project)
    console.log(`C: ${await skillNames(skillsFolder("C", project))} from nuxt-skill-hub ${skillHubVersion} (${c})`)
    known[`C/${project}`] = { source: `nuxt-skill-hub@${skillHubVersion} (nuxt prepare on ${relative(repoRoot, fixture)})`, hash: c, fetchedAt }
  }
  else console.log(`C: skipped, ${project} has no Nuxt starting app`)
  await writeFile(sources, `${JSON.stringify(known, null, 2)}\n`)
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
