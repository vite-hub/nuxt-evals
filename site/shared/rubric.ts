// Rubric grading, shared by the CLI (which grades) and the site (which shows the grades).
// The rubric itself is tasks/<project>/RUBRIC.md; `tasks/meetups/rubric.ts` reads it into this shape.

export type CheckMethod = "run" | "read" | "both" | "log"
export type CheckOutcome = "pass" | "fail" | "na" | "unverified"

/** Which part of the headline a section counts toward. Sections whose title starts with "ViteHub" are `vitehub`. */
export type SectionPart = "general" | "vitehub"

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
  /** `vitehub` for the ViteHub sections, which share their own part of the headline. Older grades have no part: `general`. */
  part?: SectionPart
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
  /** 0 to 10, one decimal: the weighted share of checks that pass, or null when every check is n/a or unverified. */
  score: number | null
  failedMajor: string[]
  failedMinor: string[]
  unverified: string[]
}

/** One judge session: a group of sections, the setup step, or the vibe pass. */
export interface JudgeSession {
  name: string
  durationMs: number
  costUsd?: number
  turns?: number
  error?: string
}

/** One Vite Doctor diagnostic, as the grade keeps it. */
export interface DoctorDiagnostic {
  rule: string
  code: string
  severity: "blocker" | "error" | "warn" | "info"
  message: string
  path?: string
  line?: number
}

/** Vite Doctor's report on the app, scored against the reference app's report. */
export interface DoctorGrade {
  /** 0 to 10, one decimal: 10 × 15 / (15 + points), or null when Doctor could not run. */
  score: number | null
  /** The vite-doctor version that ran. */
  version?: string
  /** Charged diagnostics by severity (blocker 10, error 3, warn 1, info 0), each rule at most 5 times. */
  points: number
  /** Points of rules that also fire on the reference app. They don't count. */
  referencePoints: number
  /** The rules the reference app fires with the same Doctor. */
  baselineRules: string[]
  counts: Record<DoctorDiagnostic["severity"], number>
  /** Whether Doctor resolved the installed Nuxt, Nitro and h3 versions. Without them it skips version-specific rules. */
  resolved: boolean
  /** What went wrong, or what Doctor could not see. */
  note?: string
  diagnostics: DoctorDiagnostic[]
}

/** One observation of the vibe pass, with the lines it is about. */
export interface VibeFinding {
  kind: "missing-abstraction" | "superfluous-abstraction" | "reinvented" | "structure" | "elegant"
  text: string
  sources?: CheckSource[]
}

/** The vibe pass: design quality a linter can't see, 0 to 10. Shown on its own; not part of the headline. */
export interface VibeGrade {
  /** 0 to 10, one decimal, or null when the pass failed. */
  score: number | null
  summary: string
  findings: VibeFinding[]
}

/** What the Opus judge gave a run (or the reference) against the rubric. */
export interface RubricGrade {
  rubric: string
  judge: { harness: "claude-code", model: string, effort: string }
  gradedAt: string
  /** Whether the production build installed, built and started. A run that didn't scores 0. */
  started: boolean
  /** How the setup step started the app, and what it noticed. */
  setupNotes?: string
  checks: CheckResult[]
  sections: SectionScore[]
  /** The headline, 0 to 10 with one decimal: the weighted mean in `headlineWeights`. */
  score: number
  /** The rubric alone, 0 to 10: the general and ViteHub parts, without Vite Doctor. */
  rubricScore?: number
  doctor?: DoctorGrade | null
  vibe?: VibeGrade | null
  sessions: JudgeSession[]
}

/** How much a check weighs in its section. */
export const checkWeight = { major: 3, minor: 1 } as const

/**
 * The headline's parts. The general sections share 65% equally, the ViteHub sections 25%, and Vite Doctor 10%. A part
 * with nothing to score (no ViteHub section graded, Doctor didn't run) drops out and the others grow to fill it.
 */
export const headlineWeights = { general: 0.65, vitehub: 0.25, doctor: 0.1 } as const

const oneDecimal = (value: number) => Math.round(value * 10) / 10

/**
 * A section's score: the weighted share of its checks that pass, times 10. Major checks weigh 3, minor 1; n/a counts as
 * a pass; unverified checks are left out. A run that didn't start scores 0.
 */
export function scoreSection(checks: RubricCheck[], results: Map<string, CheckResult>, started = true): SectionScore {
  const key = checks[0]?.section ?? ""
  const failedMajor: string[] = []
  const failedMinor: string[] = []
  const unverified: string[] = []
  let total = 0
  let passed = 0
  let applicable = 0
  for (const check of checks) {
    const outcome = results.get(check.id)?.outcome ?? "unverified"
    if (outcome === "unverified") {
      unverified.push(check.id)
      continue
    }
    const weight = check.major ? checkWeight.major : checkWeight.minor
    total += weight
    if (outcome !== "na") applicable++
    if (outcome === "fail") (check.major ? failedMajor : failedMinor).push(check.id)
    else passed += weight
  }
  if (!started) return { key, score: 0, failedMajor, failedMinor, unverified }
  if (!total || !applicable) return { key, score: null, failedMajor, failedMinor, unverified }
  return { key, score: oneDecimal(10 * passed / total), failedMajor, failedMinor, unverified }
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

/** The headline from section scores and Doctor's score, with `headlineWeights`. Parts with nothing to score drop out. */
export function headline(sections: RubricSection[], scores: SectionScore[], doctor?: number | null): { score: number, rubricScore: number } {
  const partOf = new Map(sections.map(section => [section.key, section.part ?? "general"]))
  const part = (name: keyof typeof headlineWeights) => mean(scores.filter(score => score.score !== null && partOf.get(score.key) === name).map(score => score.score!))
  const parts = [
    { weight: headlineWeights.general, value: part("general") },
    { weight: headlineWeights.vitehub, value: part("vitehub") },
  ]
  const weighted = (list: { weight: number, value: number | null | undefined }[]) => {
    const present = list.filter((item): item is { weight: number, value: number } => item.value !== null && item.value !== undefined)
    const weight = present.reduce((sum, item) => sum + item.weight, 0)
    return weight ? present.reduce((sum, item) => sum + item.weight * item.value, 0) / weight : 0
  }
  return {
    score: oneDecimal(weighted([...parts, { weight: headlineWeights.doctor, value: doctor }])),
    rubricScore: oneDecimal(weighted(parts)),
  }
}

export function scoreRubric(rubric: Rubric, results: CheckResult[], started: boolean, doctor?: number | null): { sections: SectionScore[], score: number, rubricScore: number } {
  const byId = new Map(results.map(result => [result.id, result]))
  const sections = rubric.sections.map(section => scoreSection(rubric.checks.filter(check => check.section === section.key), byId, started))
  if (!started) return { sections, score: 0, rubricScore: 0 }
  return { sections, ...headline(rubric.sections, sections, doctor) }
}
