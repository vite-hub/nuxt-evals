// Rubric grading, shared by the CLI (which grades) and the site (which shows the grades).
// The rubric itself is tasks/<project>/RUBRIC.md; `tasks/meetups-v2/rubric.ts` reads it into this shape.

export type CheckMethod = "run" | "read" | "both" | "log"
export type CheckOutcome = "pass" | "fail" | "na" | "unverified"

export interface RubricCheck {
  /** `P12`: the section letter and a number. */
  id: string
  /** The section letter, such as `P`. */
  section: string
  /** The check as RUBRIC.md writes it, Markdown included. */
  text: string
  method: CheckMethod
  major: boolean
}

/** A docs page a section's checks come from: the "see" of a check. */
export interface RubricLink {
  label: string
  url: string
}

export interface RubricSection {
  /** The letter its check ids start with. */
  key: string
  number: number
  title: string
  /** The links of the section's `Sources:` line in RUBRIC.md. */
  docs?: RubricLink[]
}

export interface Rubric {
  sections: RubricSection[]
  checks: RubricCheck[]
}

/** A place in the graded app's code, such as `app/pages/index.vue:6-9`. */
export interface CheckSource {
  /** The file, from the app's root. */
  path: string
  /** The first line, counted from 1. */
  line: number
  /** The last line, when the place is more than one line. */
  endLine?: number
}

/**
 * One check's result, read like a nostics diagnostic: the check id is the code, `evidence` the why, `fix` the fix,
 * `sources` the places in the code, and the section's `docs` the "see" links.
 */
export interface CheckResult {
  id: string
  outcome: CheckOutcome
  /** What the judge saw: a file and line with a quote, or a request and what came back. */
  evidence: string
  /** For a fail: what the app should do instead. Markdown, with a short fenced code block when code says it best. */
  fix?: string
  /** Where in the app's code the judge saw it. The CLI keeps only places that exist in the app's files. */
  sources?: CheckSource[]
}

export interface SectionScore {
  key: string
  /** 1 to 5, or null when every check is n/a or unverified. */
  score: number | null
  failedMajor: string[]
  failedMinor: string[]
  unverified: string[]
}

/** One judge session: a group of sections, or the setup step. */
export interface JudgeSession {
  name: string
  durationMs: number
  costUsd?: number
  turns?: number
  error?: string
}

/** What the Opus judge gave a run (or the reference) against the rubric. */
export interface RubricGrade {
  rubric: string
  judge: { harness: "claude-code", model: string, effort: string }
  gradedAt: string
  /** Whether the production build installed, built and started. A run that didn't scores 1 in every section. */
  started: boolean
  /** How the setup step started the app, and what it noticed. */
  setupNotes?: string
  checks: CheckResult[]
  sections: SectionScore[]
  /** Mean of the section scores, 1 to 5. */
  score: number
  sessions: JudgeSession[]
}

/**
 * RUBRIC.md's anchors: 5 = every major passes and at most one minor fails; 4 = two or three minor fail; 3 = one major
 * fails or four or more minor fail; 2 = two or three major fail; 1 = four or more major fail. n/a counts as a pass;
 * unverified counts as neither.
 */
export function scoreSection(checks: RubricCheck[], results: Map<string, CheckResult>, started = true): SectionScore & { key: string } {
  const key = checks[0]?.section ?? ""
  const failedMajor: string[] = []
  const failedMinor: string[] = []
  const unverified: string[] = []
  let graded = 0
  let applicable = 0
  for (const check of checks) {
    const outcome = results.get(check.id)?.outcome ?? "unverified"
    if (outcome === "unverified") {
      unverified.push(check.id)
      continue
    }
    graded++
    if (outcome !== "na") applicable++
    if (outcome === "fail") (check.major ? failedMajor : failedMinor).push(check.id)
  }
  if (!started) return { key, score: 1, failedMajor, failedMinor, unverified }
  if (!graded || !applicable) return { key, score: null, failedMajor, failedMinor, unverified }
  const major = failedMajor.length
  const minor = failedMinor.length
  const score = major >= 4 ? 1 : major >= 2 ? 2 : major === 1 || minor >= 4 ? 3 : minor >= 2 ? 4 : 5
  return { key, score, failedMajor, failedMinor, unverified }
}

export function scoreRubric(rubric: Rubric, results: CheckResult[], started: boolean): { sections: SectionScore[], score: number } {
  const byId = new Map(results.map(result => [result.id, result]))
  const sections = rubric.sections.map(section => scoreSection(rubric.checks.filter(check => check.section === section.key), byId, started))
  const scored = sections.map(section => section.score).filter((score): score is number => score !== null)
  const score = scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : 1
  return { sections, score: Math.round(score * 100) / 100 }
}
