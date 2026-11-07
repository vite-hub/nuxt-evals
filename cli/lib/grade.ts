import type { AgentSession, AgentSessionTool } from "@vite-hub/agent/sessions"
import type { ProbeResult, RunAudit, RunDiagnostics, RunFile } from "../../site/shared/report.ts"
import contactEndpoint from "../../tasks/contact-endpoint/task.ts"
import type { Task } from "../../tasks/types.ts"

export const tasks: Record<string, Task> = {
  [contactEndpoint.id]: contactEndpoint,
}

export async function gradeProbes(task: Task, files: RunFile[], diff: string): Promise<ProbeResult[]> {
  const changed = new Set([...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(match => match[1]))
  const source = files.filter(file => changed.has(file.path)).map(file => file.content).join("\n")
  return await Promise.all(task.probes.map(async probe => ({
    id: probe.id,
    title: probe.title,
    layer: probe.layer,
    passed: await probe.check({ files, source }),
  })))
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
