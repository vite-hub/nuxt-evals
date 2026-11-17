// Vite Doctor in the grading: static diagnostics for Nuxt, Vue, Nitro and Vite, read from its JSON report.
// The judge's setup step installs and builds the app first, so Doctor resolves the installed Nuxt, Nitro and h3
// versions and runs its version-specific rules too.
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { promisify } from "node:util"
import type { DoctorDiagnostic, DoctorGrade } from "../../site/shared/rubric.ts"
import { cliRoot } from "./paths.ts"

/** What one diagnostic costs, by severity. */
export const doctorWeights: Record<DoctorDiagnostic["severity"], number> = { blocker: 10, error: 3, warn: 1, info: 0 }
/** One rule counts at most this many times: twenty unlabeled buttons are one habit, not twenty. */
export const doctorRuleCap = 5
/** Excess points at which the score is 5. */
const halfScoreAt = 15

/**
 * Rules beyond Doctor's recommended preset for mistakes from the replies on X that a linter can find. Recommended
 * keeps only rules whose hits are defects; these are opinions the replies share.
 */
const evalRules: Record<string, "warn"> = {
  "vue/reactivity/prefer-computed-over-watch-assign": "warn",
  "vue/lifecycle/prefer-use-event-listener": "warn",
  "vueuse/prefer-use-timers": "warn",
}

interface DoctorReport {
  version?: string
  diagnostics: { rule: string, code: string, severity: DoctorDiagnostic["severity"], message: string, confidence?: string, remediation?: string, docs?: string, location?: { path?: string, line?: number, column?: number } }[]
  runtimeGraph?: { packages?: { nuxt?: { state?: string } } }
  nuxtCompatibility?: { state?: string }
}

function doctorCli(): string {
  if (process.env.VITE_DOCTOR_CLI) return process.env.VITE_DOCTOR_CLI
  const manifest = createRequire(join(cliRoot, "package.json")).resolve("vite-doctor/package.json")
  return join(dirname(manifest), "dist/cli.mjs")
}

/** Runs Doctor on an installed app. Never throws: a failed run comes back with `score: null` and a note. */
export async function runDoctor(app: string): Promise<{ report?: DoctorReport, note?: string }> {
  // The eval's rules, written into the grader's copy of the app. An app's own doctor.config.json would change what
  // Doctor reports, so it is replaced, and the note says so.
  const own = existsSync(join(app, "doctor.config.json"))
  await writeFile(join(app, "doctor.config.json"), JSON.stringify({ rules: evalRules }, null, 2))
  try {
    // Doctor exits with 1 when it finds errors; the report is still on stdout.
    const { stdout } = await promisify(execFile)("heavy", ["--light", process.execPath, doctorCli(), ".", "--format", "json", "--no-cache", "--no-server"], {
      cwd: app,
      maxBuffer: 64 * 1024 * 1024,
      // The time limit covers the wait for a light slot, which takes minutes on a busy machine; heavy stops Doctor itself after 5.
      timeout: 20 * 60_000,
    }).catch((error: { stdout?: string, message: string }) => {
      if (error.stdout?.trim().startsWith("{")) return { stdout: error.stdout }
      throw error
    })
    const report = JSON.parse(stdout.slice(stdout.indexOf("{"))) as DoctorReport
    return { report, ...(own ? { note: "The app's own doctor.config.json was replaced by the eval's." } : {}) }
  }
  catch (error) {
    return { note: `Doctor did not run: ${error instanceof Error ? error.message.slice(0, 300) : String(error)}` }
  }
}

/** The rules a report fires, for the reference app's baseline. */
export function firedRules(grade: DoctorGrade | null | undefined): string[] {
  return [...new Set(grade?.diagnostics.map(diagnostic => diagnostic.rule) ?? [])].sort()
}

/**
 * Doctor's score, 0 to 10. `expectsNuxt` is false for an app without Nuxt (a Vue single-page app), where an unresolved
 * Nuxt version is no gap to report. Diagnostics of rules that also fire on the reference app don't count: the reference is the
 * model answer, so those hits are noise for this task. The rest weigh by severity, each rule at most `doctorRuleCap`
 * times, and the score halves at `halfScoreAt` points: 10 × 15 / (15 + points).
 */
export function scoreDoctor(report: DoctorReport | undefined, note: string | undefined, baseline: string[], expectsNuxt = true): DoctorGrade {
  const counts: DoctorGrade["counts"] = { blocker: 0, error: 0, warn: 0, info: 0 }
  if (!report) return { score: null, points: 0, referencePoints: 0, counts, resolved: false, note: note ?? "Doctor did not run.", diagnostics: [], baselineRules: baseline }
  const diagnostics: DoctorDiagnostic[] = report.diagnostics.map(diagnostic => ({
    rule: diagnostic.rule,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.location?.path ? { path: diagnostic.location.path } : {}),
    ...(diagnostic.location?.line ? { line: diagnostic.location.line } : {}),
    ...(diagnostic.location?.column ? { column: diagnostic.location.column } : {}),
    ...(diagnostic.confidence ? { confidence: diagnostic.confidence } : {}),
    ...(diagnostic.remediation ? { remediation: diagnostic.remediation } : {}),
    ...(diagnostic.docs ? { docs: diagnostic.docs } : {}),
  }))
  const perRule = new Map<string, number>()
  let points = 0
  let referencePoints = 0
  for (const diagnostic of diagnostics) {
    counts[diagnostic.severity]++
    const seen = perRule.get(diagnostic.rule) ?? 0
    perRule.set(diagnostic.rule, seen + 1)
    if (seen >= doctorRuleCap) continue
    if (baseline.includes(diagnostic.rule)) referencePoints += doctorWeights[diagnostic.severity]
    else points += doctorWeights[diagnostic.severity]
  }
  const resolved = report.runtimeGraph?.packages?.nuxt?.state === "resolved"
  const notes = [note, resolved || !expectsNuxt ? "" : "Doctor could not resolve the installed Nuxt version, so it skipped its version-specific rules."].filter(Boolean)
  return {
    score: Math.round(100 * halfScoreAt / (halfScoreAt + points)) / 10,
    ...(report.version ? { version: report.version } : {}),
    points,
    referencePoints,
    counts,
    resolved,
    ...(notes.length ? { note: notes.join(" ") } : {}),
    diagnostics,
    baselineRules: baseline,
  }
}

/** The rules the project's reference app fires, from its stored grade. */
export async function referenceBaseline(gradeFile: string): Promise<string[]> {
  const grade = JSON.parse(await readFile(gradeFile, "utf8").catch(() => "null")) as { doctor?: DoctorGrade | null } | null
  return firedRules(grade?.doctor)
}
