import type { AgentSession, AgentSessionTool } from "@vite-hub/agent/sessions"
import type { ProbeResult, RunAudit, RunDiagnostics, RunFile } from "../../site/shared/report.ts"
import contactEndpoint from "../../tasks/contact-endpoint/task.ts"
import meetups from "../../tasks/meetups/task.ts"
import type { ProbeOutcome, StartedTask, Task } from "../../tasks/types.ts"

export const tasks: Record<string, Task<unknown>> = {
  [contactEndpoint.id]: contactEndpoint,
  [meetups.id]: meetups,
}

function outcome(value: boolean | ProbeOutcome): ProbeOutcome {
  return typeof value === "boolean" ? { passed: value } : value
}

/**
 * Grades a run. File probes read `files`. Tasks with `start` also build and start the app from `work` (the agent's
 * working copy, before it is removed), run their gate and runtime probes against it in order, and stop it.
 * `log` gets one line per probe with its time.
 */
export async function gradeProbes(task: Task<unknown>, files: RunFile[], diff: string, work?: string, log?: (line: string) => void): Promise<ProbeResult[]> {
  const changedPaths = new Set([...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(match => match[1]))
  const changed = files.filter(file => changedPaths.has(file.path))
  const source = changed.map(file => file.content).join("\n")

  let started: StartedTask<unknown> | undefined
  let startFailure: string | undefined
  if (task.start) {
    const begun = performance.now()
    if (!work) startFailure = "No working copy to build."
    else started = await task.start(work).catch((error: unknown) => { startFailure = error instanceof Error ? error.message : String(error); return undefined })
    log?.(`start: ${Math.round(performance.now() - begun)} ms${startFailure ? ` (${startFailure.slice(0, 200)})` : ""}`)
  }

  const results: ProbeResult[] = []
  try {
    for (const probe of task.probes) {
      const begun = performance.now()
      const result = task.start && !started && probe.layer !== "static"
        ? { passed: false, detail: startFailure ?? "The app did not start." }
        : await Promise.resolve()
          .then(() => probe.check({ files, source, changed, runtime: started?.runtime }))
          .then(outcome, (error: unknown) => ({ passed: false, detail: `Probe error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) }))
      log?.(`${probe.id}: ${result.passed ? "pass" : "FAIL"} in ${Math.round(performance.now() - begun)} ms${result.detail ? ` (${result.detail})` : ""}`)
      results.push({ id: probe.id, title: probe.title, layer: probe.layer, passed: result.passed, ...(result.detail ? { detail: result.detail } : {}) })
    }
  }
  finally {
    await started?.stop()
  }
  return results
}

export function score(probes: ProbeResult[]): { gatePassed: boolean, score: number } {
  const gatePassed = probes.filter(probe => probe.layer === "gate").every(probe => probe.passed)
  return { gatePassed, score: gatePassed ? probes.filter(probe => probe.passed).length / probes.length : 0 }
}

function tools(session: AgentSession): AgentSessionTool[] {
  return session.steps.filter((step): step is AgentSessionTool => step.type === "tool")
}

function commandOf(tool: AgentSessionTool): string {
  const input = tool.input as { command?: unknown } | undefined
  return typeof input?.command === "string" ? input.command : ""
}

/** Claude Code prefixes MCP tools with `mcp__`. Codex uses the server's own tool names, so the Nuxt MCP's are listed. */
const nuxtMcpTool = /^(get|list)[_-](documentation|blog|changelog|deploy|getting|module|nuxter)/
export const isMcpTool = (name: string) => name.startsWith("mcp") || nuxtMcpTool.test(name)

export function diagnose(session: AgentSession): Omit<RunDiagnostics, "audit" | "error"> {
  const used = tools(session)
  const names = used.map(tool => tool.name)
  const commands = used.map(commandOf)
  return {
    toolCalls: used.length,
    mcpCalls: names.filter(isMcpTool).length,
    skillReads: commands.filter(command => /SKILL\.md|\/skills\//.test(command)).length + names.filter(name => /skill/i.test(name)).length,
    webFetches: names.filter(name => /web_?search|web_?fetch/i.test(name)).length,
    tools: [...new Set(names)],
  }
}

/** Codex lists every skill it offers in a `<skills_instructions>` block of its developer message. */
function codexSkills(sessionText: string): string[] {
  const skills = new Set<string>()
  for (const block of sessionText.matchAll(/<skills_instructions>([\s\S]*?)<\/skills_instructions>/g)) {
    for (const match of block[1]!.replaceAll("\\n", "\n").matchAll(/^- ([\w:.-]+): /gm)) skills.add(match[1]!)
  }
  return [...skills].sort()
}

/** Claude Code lists its tools, MCP servers, skills and plugins in the first `system/init` event of `stream-json`. */
function claudeInit(streamText: string): { skills: string[], mcpServers: string[], plugins: string[] } {
  for (const line of streamText.split("\n")) {
    if (!line.includes(`"subtype":"init"`)) continue
    const event = JSON.parse(line) as { skills?: unknown[], mcp_servers?: { name?: string }[], plugins?: { name?: string, path?: string }[] }
    return {
      skills: (event.skills ?? []).map(skill => typeof skill === "string" ? skill : JSON.stringify(skill)).sort(),
      mcpServers: (event.mcp_servers ?? []).map(server => server.name ?? "unknown"),
      // Claude Code ships some plugins inside the CLI (`path: "builtin"`), like Codex ships its system skills.
      plugins: (event.plugins ?? []).filter(plugin => plugin.path !== "builtin").map(plugin => plugin.name ?? "unknown"),
    }
  }
  return { skills: [], mcpServers: [], plugins: [] }
}

/** Skills every Codex build bundles. Every setup allows them. */
const codexSystemSkills = new Set(["imagegen", "openai-docs", "plugin-creator", "skill-creator", "skill-installer"])
/** Skills Claude Code 2.1 bundles (`system/init` of a bare run in an empty HOME). */
const claudeBundledSkills = new Set(["batch", "claude-api", "code-review", "dataviz", "debug", "deep-research", "doctor", "fewer-permission-prompts", "loop", "plugin-authoring", "run", "run-skill-generator", "simplify", "update-config", "verify", "workflow-authoring"])

export interface AuditExpectation {
  /** Skill names the setup installs, including skills nested in their folders (Codex lists those too). */
  skills: string[]
  /** The skills that must show up, so a setup that failed to install is caught. */
  required: string[]
  mcpServers: string[]
  /** The agent's own skills folder. Reading it is part of the setup, not a look outside the working copy. */
  skillsDir?: string
}

/** What the agent was offered and where it looked. A run must see exactly its setup: no other skills, MCP servers or plugins. */
export function audit(session: AgentSession, sessionText: string, streamText: string, work: string, expected: AuditExpectation): RunAudit {
  const problems: string[] = []
  const codex = session.provider === "codex"
  const offered = codex
    ? { skills: codexSkills(sessionText), mcpServers: expected.mcpServers, plugins: [] as string[] }
    : claudeInit(streamText)
  const bundled = codex ? codexSystemSkills : claudeBundledSkills
  const allowed = new Set([...bundled, ...expected.skills])
  const extra = offered.skills.filter(skill => !allowed.has(skill))
  if (extra.length) problems.push(`Offered skills outside the setup: ${extra.join(", ")}.`)
  const missing = expected.required.filter(skill => !offered.skills.includes(skill))
  if (missing.length) problems.push(`Setup skills not offered: ${missing.join(", ")}.`)
  const extraServers = offered.mcpServers.filter(server => !expected.mcpServers.includes(server))
  if (extraServers.length) problems.push(`Offered MCP servers outside the setup: ${extraServers.join(", ")}.`)
  const missingServers = expected.mcpServers.filter(server => !offered.mcpServers.includes(server))
  if (missingServers.length) problems.push(`Setup MCP servers not offered: ${missingServers.join(", ")}.`)
  if (offered.plugins.length) problems.push(`Loaded plugins: ${offered.plugins.join(", ")}.`)
  // Heredoc bodies are file contents, not paths the command reads. Reads of the agent's own skills are part of the setup.
  const outsideReads = tools(session).map(commandOf)
    .map(command => command.replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\2(?=\s|$)/g, "<<heredoc"))
    .map(command => expected.skillsDir ? command.replaceAll(expected.skillsDir, "<skills>") : command)
    .filter(command =>
      /(^|[\s'"=(])\.\.(\/|\s|$)/.test(command) || /(^|[\s'"=])(~\/|\$HOME|\/home\/)/.test(command)
      || (work && command.includes(work) === false && /\scd\s+\//.test(command)))
  if (outsideReads.length) problems.push(`${outsideReads.length} command(s) looked outside the working copy.`)
  // The probes, references and setups live in the eval repository. Reading them is cheating, whatever the reason.
  const graderReads = tools(session).map(commandOf).filter(command => /nuxt-evals\/(tasks|cli|site|setups|research)\b/.test(command))
  if (graderReads.length) problems.push(`${graderReads.length} command(s) read the eval's own files.`)
  return { passed: problems.length === 0, skills: offered.skills, mcpServers: offered.mcpServers, outsideReads, problems }
}
