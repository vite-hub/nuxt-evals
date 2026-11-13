// Setups. A: bare. B: the Nuxt MCP and the core Nuxt skill from nuxt-skill.onmax.me. C: the Nuxt MCP and the skill
// nuxt-skill-hub generates for the project, which adds a skill for each installed module (Nuxt UI, VueUse, ...).
// Skills are snapshots in this repository (`setups/`), so every run of a setup gets the same files.
// `pnpm evals skills <project>` refreshes them.
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, relative } from "node:path"
import { promisify } from "node:util"
import type { Harness } from "../../site/shared/report.ts"
import { fixtureFolder, repoRoot } from "./paths.ts"
import { installDependencies, runHeavy, type TaskFixture } from "./prepare.ts"

const exec = promisify(execFile)

export type Setup = "A" | "B" | "C"
export const setups: Setup[] = ["A", "B", "C"]

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
}

export const setupsRoot = join(repoRoot, "setups")
const hostedSkill = "https://nuxt-skill.onmax.me/.well-known/skills"
const skillHubVersion = "0.3.1"

const exists = (path: string) => access(path).then(() => true, () => false)

async function skillNames(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
}

function skillsFolder(setup: Setup, project: string): string {
  return setup === "B" ? join(setupsRoot, "B/skills") : join(setupsRoot, "C", project, "skills")
}

export async function planSetup(setup: Setup, project: string): Promise<SetupPlan> {
  if (setup === "A") return { setup, mcpServers: [], skills: [] }
  const skillsDir = skillsFolder(setup, project)
  const skills = await skillNames(skillsDir)
  if (!skills.length) throw new Error(`Setup ${setup} has no skills in ${relative(repoRoot, skillsDir)}. Run \`pnpm evals skills ${project}\`.`)
  return { setup, mcpServers: [nuxtMcp], skillsDir, skills }
}

/** Where each harness reads user skills from, inside the run's own HOME. */
export function agentSkillsDir(harness: Harness, home: string): string {
  return harness === "codex" ? join(home, ".codex/skills") : join(home, ".claude/skills")
}

/** Copies the setup's skills into the agent's HOME. The working copy stays the same in every setup. */
export async function installSetup(plan: SetupPlan, harness: Harness, home: string): Promise<void> {
  if (!plan.skillsDir) return
  const target = agentSkillsDir(harness, home)
  await mkdir(target, { recursive: true })
  for (const skill of plan.skills) await cp(join(plan.skillsDir, skill), join(target, skill), { recursive: true })
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

/**
 * C: what a project gets after `npx nuxi module add nuxt-skill-hub` and `nuxt prepare`. Generated in a scratch copy
 * of the fixture, so the fixture itself stays the same in every setup.
 */
export async function generateProjectSkill(task: TaskFixture): Promise<string> {
  const project = task.id
  const fixture = fixtureFolder(task)
  const scratch = join(homedir(), ".cache/nuxt-evals", `skill-hub-${project}-${process.pid}`)
  await rm(scratch, { recursive: true, force: true })
  await cp(fixture, scratch, { recursive: true, filter: source => !/node_modules|\.nuxt|\.output/.test(source) })
  try {
    await installDependencies(task, scratch)
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

/** Refreshes the skill snapshots of setups B and C and records where they came from. */
export async function refreshSkills(task: TaskFixture): Promise<void> {
  const project = task.id
  const b = await snapshotHostedSkill()
  console.log(`B: ${await skillNames(skillsFolder("B", project))} from ${hostedSkill} (${b})`)
  const c = await generateProjectSkill(task)
  console.log(`C: ${await skillNames(skillsFolder("C", project))} from nuxt-skill-hub ${skillHubVersion} (${c})`)
  const sources = join(setupsRoot, "sources.json")
  const known = await exists(sources) ? JSON.parse(await readFile(sources, "utf8")) as Record<string, unknown> : {}
  known.B = { source: hostedSkill, hash: b, fetchedAt: new Date().toISOString() }
  known[`C/${project}`] = { source: `nuxt-skill-hub@${skillHubVersion} (nuxt prepare on ${relative(repoRoot, fixtureFolder(task))})`, hash: c, fetchedAt: new Date().toISOString() }
  await writeFile(sources, `${JSON.stringify(known, null, 2)}\n`)
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
    skills: plan.skillsDir ? await declaredSkills(plan.skillsDir) : [],
    required: plan.skills,
    mcpServers: plan.mcpServers.map(server => server.name),
    skillsDir: agentSkillsDir(harness, home),
  }
}
