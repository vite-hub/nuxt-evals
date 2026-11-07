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

export function diagnose(session: AgentSession): Omit<RunDiagnostics, "audit" | "error"> {
  const used = tools(session)
  const names = used.map(tool => tool.name)
  const commands = used.map(commandOf)
  return {
    toolCalls: used.length,
    mcpCalls: names.filter(name => name.startsWith("mcp")).length,
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

/** Skills every Codex build bundles. Setup A allows only these. */
const codexSystemSkills = new Set(["imagegen", "openai-docs", "plugin-creator", "skill-creator", "skill-installer"])

/** What the agent was offered and where it looked. Setup A must see no extra skills, no MCP servers and no plugins. */
export function audit(session: AgentSession, sessionText: string, streamText: string, work: string): RunAudit {
  const problems: string[] = []
  const offered = session.provider === "codex"
    ? { skills: codexSkills(sessionText), mcpServers: [] as string[], plugins: [] as string[] }
    : claudeInit(streamText)
  const extra = session.provider === "codex" ? offered.skills.filter(skill => !codexSystemSkills.has(skill)) : []
  if (extra.length) problems.push(`Offered skills outside the setup: ${extra.join(", ")}.`)
  if (offered.mcpServers.length) problems.push(`Offered MCP servers: ${offered.mcpServers.join(", ")}.`)
  if (offered.plugins.length) problems.push(`Loaded plugins: ${offered.plugins.join(", ")}.`)
  // Heredoc bodies are file contents, not paths the command reads.
  const outsideReads = tools(session).map(commandOf).map(command => command.replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\2(?=\s|$)/g, "<<heredoc")).filter(command =>
    /(^|[\s'"=(])\.\.(\/|\s|$)/.test(command) || /(^|[\s'"=])(~\/|\$HOME|\/home\/)/.test(command)
    || (work && command.includes(work) === false && /\scd\s+\//.test(command)))
  if (outsideReads.length) problems.push(`${outsideReads.length} command(s) looked outside the working copy.`)
  return { passed: problems.length === 0, skills: offered.skills, mcpServers: offered.mcpServers, outsideReads, problems }
}
