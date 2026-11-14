import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { referenceReply, score, type Format } from "./score.ts"
import { findTask } from "./sets.ts"

/**
 * Scores every reference without a model call. `<format>.json[l]` must validate and pass every rubric check.
 * `<format>.alt-<name>.*` is another correct layout and must pass too. `<format>.wrong-invalid.*` must fail validation,
 * and `<format>.wrong-rubric.*` must validate but fail a rubric check.
 */
export function checkReferences(): { file: string, ok: boolean, detail: string }[] {
  const root = new URL("./references/", import.meta.url)
  const results: { file: string, ok: boolean, detail: string }[] = []
  for (const taskId of readdirSync(root).sort()) {
    const task = findTask(taskId)
    for (const name of readdirSync(new URL(`${taskId}/`, root)).sort()) {
      const match = /^(json-render|a2ui)(?:\.(wrong-invalid|wrong-rubric|alt-[\w-]+))?\.jsonl?$/.exec(name)
      if (!match) throw new Error(`Unexpected reference file ${taskId}/${name}.`)
      const format = match[1] as Format
      const wrong = match[2]?.startsWith("wrong-") ? match[2].slice(6) : undefined
      const path = fileURLToPath(new URL(`${taskId}/${name}`, root))
      const file = readFileSync(path, "utf8")
      const reply = referenceReply(format, file)
      const result = score(format, task, reply)
      const failed = result.checks.filter(check => !check.pass).map(check => check.id)
      const ok = wrong === "invalid" ? !result.valid : wrong === "rubric" ? result.valid && !result.rubricComplete : result.pass
      const detail = result.valid
        ? (failed.length ? `valid, rubric fails: ${failed.join(", ")}` : `valid, ${result.checks.length}/${result.checks.length} checks`)
        : `invalid: ${result.errors.slice(0, 2).join("; ")}`
      results.push({ file: `${taskId}/${name}`, ok, detail })
    }
  }
  return results
}

if (import.meta.main) {
  const results = checkReferences()
  for (const result of results) console.log(`${result.ok ? "ok  " : "FAIL"} ${result.file.padEnd(48)} ${result.detail}`)
  const failures = results.filter(result => !result.ok).length
  console.log(failures ? `${failures} of ${results.length} references are wrong.` : `All ${results.length} references behave as expected.`)
  process.exitCode = failures ? 1 : 0
}
