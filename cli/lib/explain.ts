// Adds `fix` and `sources` to a grade, without grading again, so the site can show a check like a nostics diagnostic.
// Graders return them for every fail since 2026-11-11, so on new grades this step only adds the reference's passes.
// Claude Code with the judge's model reads the app's code (Read, Glob and Grep only: no server, no install) and, for each
// check it is given, cites the lines the judge's evidence is about and, for a fail, says what the app should do instead.
// Outcomes, evidence, scores and judge sessions stay as they are. This is its own step, after the judge, so that asking
// for fixes can't change how the judge grades. A check counts as explained once it has `sources` (`[]` when there is
// nothing to cite) and, for a fail, a `fix`.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import type { RunFile } from "../../site/shared/report.ts"
import type { CheckOutcome, CheckResult, RubricGrade } from "../../site/shared/rubric.ts"
import { readRubric } from "../../tasks/rubric.ts"
import { fileBytes } from "./workspace.ts"
import { askClaude, judgeConfig, runJobs } from "./judge.ts"
import { type RawSource, resolveSource, resolveSources } from "./sources.ts"

const sourcesSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      path: { type: "string", description: "From the app's root." },
      line: { type: "integer", minimum: 1 },
      endLine: { type: "integer", minimum: 1 },
      quote: { type: "string", description: "The exact text of the first cited line." },
    },
    required: ["path", "line", "quote"],
  },
} as const

const explainSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          fix: { type: "string" },
          sources: sourcesSchema,
          disagree: { type: "string", description: "Only when the code shows the judge's outcome is wrong: why. Empty otherwise." },
        },
        required: ["id", "sources"],
      },
    },
  },
  required: ["results"],
} as const

interface ExplainOptions {
  /** Shown in logs and used for the temp folder's name. */
  label: string
  files: RunFile[]
  grade: RubricGrade
  /** Fails for a run. The reference explains its passes too: they are the code the site shows next to a run's fail. */
  outcomes: CheckOutcome[]
  /** An app that passes the rubric. The fixes take their APIs from it, so they name ones that exist. */
  reference?: RunFile[]
  /** Where the transcripts go, as explain-<group>.jsonl. */
  outDir: string
  log: (line: string) => void
}

export interface ExplainStats {
  explained: number
  fixes: number
  withSources: number
  sources: number
  dropped: string[]
  disagreements: { id: string, note: string }[]
  costUsd: number
  durationMs: number
}

/** Returns the grade with `fix` and `sources` on the checks it explained. Never throws for a failed session. */
export async function explainGrade(options: ExplainOptions): Promise<{ grade: RubricGrade, stats: ExplainStats }> {
  const started = Date.now()
  const project = options.grade.rubric === "meetups-v2" ? "meetups" : options.grade.rubric
  const rubric = readRubric(project)
  const { groups, apis } = judgeConfig(project)
  const stats: ExplainStats = { explained: 0, fixes: 0, withSources: 0, sources: 0, dropped: [], disagreements: [], costUsd: 0, durationMs: 0 }
  const byId = new Map(options.grade.checks.map(check => [check.id, check]))
  const todo = (id: string) => {
    const check = byId.get(id)
    return check && options.outcomes.includes(check.outcome) && (check.sources === undefined || (check.outcome === "fail" && !check.fix))
  }
  const pending = groups.map(group => ({ ...group, checks: rubric.checks.filter(check => group.sections.includes(check.section) && todo(check.id)) })).filter(group => group.checks.length)
  if (!pending.length) {
    options.log("explain: nothing to explain")
    return { grade: options.grade, stats }
  }

  const root = await mkdtemp(join(tmpdir(), `explain-${options.label}-`))
  const app = join(root, "app")
  const home = join(root, "home")
  await mkdir(join(home, ".claude"), { recursive: true })
  await mkdir(options.outDir, { recursive: true })
  const reference = join(root, "reference")
  for (const [folder, files] of [[app, options.files], [reference, options.reference ?? []]] as const) {
    for (const file of files) {
      await mkdir(dirname(join(folder, file.path)), { recursive: true })
      await writeFile(join(folder, file.path), fileBytes(file))
    }
  }
  const rules = `- Sources: for a check that is about code, list in \`sources\` the places that show it: for a fail the lines with the problem, for a pass the lines that satisfy the check. Cite the lines themselves, not the ones next to them. At most 3, each one block of at most 30 lines (lines far apart are separate places), \`path\` from the app's root, \`quote\` the exact text of the first line. No sources when the check is about something absent, or about run behavior with no one place in the code.
- Fix: for a fail only, say in \`fix\` what this app should do instead: one or two sentences, plus a fenced code block of at most 12 lines when code says it best, written for this app's files and names. Use ${apis} APIs.${options.reference ? ` ${reference} holds another app that passes this check: before you write a fix, read how it does it and use the APIs and imports it uses. Never cite it in \`sources\` and never mention it in the fix.` : ""} When you aren't sure an API exists, describe the change in words.`

  const explained = new Map<string, CheckResult>()
  try {
    await runJobs(pending.map(group => async () => {
      const name = `explain-${group.name}`
      options.log(`${name}: ${group.checks.length} checks`)
      const list = group.checks.map((check) => {
        const result = byId.get(check.id)!
        return `- ${check.id} (${check.major ? "major" : "minor"}, ${check.method}, ${result.outcome}): ${check.text}\n  Judge's evidence: ${result.evidence}`
      }).join("\n")
      const answer = await askClaude(name, `A judge graded a web app, built by an AI coding agent, against a rubric. Its outcomes are final. Your job is to point at the code behind each outcome and, for a fail, say how to fix it. The app's code is in ${app}; read it, don't change it. You can't run it. The rubric's rules:

${rubric.header}

The sections, as RUBRIC.md writes them:

${group.sections.map(key => rubric.sectionText.get(key)).join("\n\n")}

The checks to explain, with the judge's outcome and evidence:
${list}

Rules:
${rules}
- Start from the judge's evidence: cite the places it names, after you open them and find the line. When the evidence is about a request and what came back, cite the code that produced it.
- If the code clearly shows the judge's outcome is wrong, say why in \`disagree\`, and still cite and fix as asked. Otherwise leave it empty.
- Return every check id listed above exactly once, with \`sources: []\` when there is nothing to cite.`, explainSchema, app, home, options.outDir, 20 * 60_000, "Read,Glob,Grep")
      stats.costUsd += answer.session.costUsd ?? 0
      const results = (answer.output as { results?: { id: string, fix?: string, sources?: RawSource[], disagree?: string }[] } | undefined)?.results ?? []
      const ids = new Set(group.checks.map(check => check.id))
      for (const result of results) {
        const check = byId.get(result.id)
        if (!check || !ids.has(result.id) || explained.has(result.id)) continue
        // A place in the other app is not this app's code, even when this app has a file of the same name.
        const cited = (result.sources ?? []).filter(raw => !raw.path.startsWith(reference))
        for (const raw of cited) {
          const source = resolveSource(options.files, raw)
          if (typeof source === "string") stats.dropped.push(`${result.id}: ${source}`)
        }
        const sources = resolveSources(options.files, cited)
        const fix = check.outcome === "fail" ? result.fix?.trim().slice(0, 2000) : undefined
        explained.set(result.id, { ...check, ...(fix ? { fix } : {}), sources })
        if (result.disagree?.trim()) stats.disagreements.push({ id: result.id, note: result.disagree.trim() })
      }
      const missing = [...ids].filter(id => !explained.has(id))
      options.log(`${name}: done in ${Math.round(answer.session.durationMs / 60_000)} min${answer.session.costUsd ? `, $${answer.session.costUsd}` : ""}${missing.length ? `; unexplained: ${missing.join(" ")}` : ""}${answer.session.error ? ` (${answer.session.error.slice(0, 200)})` : ""}`)
    }))
  }
  finally {
    await rm(root, { recursive: true, force: true }).catch(() => {})
  }

  const checks = options.grade.checks.map(check => explained.get(check.id) ?? check)
  for (const check of explained.values()) {
    stats.explained++
    if (check.fix) stats.fixes++
    if (check.sources?.length) stats.withSources++
    stats.sources += check.sources?.length ?? 0
  }
  stats.costUsd = Math.round(stats.costUsd * 100) / 100
  stats.durationMs = Date.now() - started
  return { grade: { ...options.grade, checks }, stats }
}
