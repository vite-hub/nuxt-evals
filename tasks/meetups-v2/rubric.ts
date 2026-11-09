import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { CheckMethod, Rubric, RubricCheck, RubricSection } from "../../site/shared/rubric.ts"

export const rubricFile = join(import.meta.dirname, "RUBRIC.md")

/** RUBRIC.md as data. RUBRIC.md stays the one source: sections are `## N. Title`, checks are table rows `| P1 | text | run | M |`. */
export function readRubric(markdown = readFileSync(rubricFile, "utf8")): Rubric & { header: string, sectionText: Map<string, string> } {
  const sections: RubricSection[] = []
  const checks: RubricCheck[] = []
  const sectionText = new Map<string, string>()
  const headings = [...markdown.matchAll(/^## (\d+)\. (.+)$/gm)]
  for (const [index, heading] of headings.entries()) {
    const end = headings[index + 1]?.index ?? markdown.search(/^## Where the checks come from/m)
    const body = markdown.slice(heading.index, end === -1 ? undefined : end).replace(/\n---\s*$/, "").trim()
    const rows = [...body.matchAll(/^\| ([A-Z])(\d+) \| (.+) \| (run|read|both|log) \| (M|m) \|\s*$/gm)]
    if (!rows.length) throw new Error(`RUBRIC.md section ${heading[1]} has no checks.`)
    const key = rows[0]![1]!
    sections.push({ key, number: Number(heading[1]), title: heading[2]!.trim() })
    sectionText.set(key, body)
    for (const row of rows) {
      if (row[1] !== key) throw new Error(`Check ${row[1]}${row[2]} sits in section ${key}.`)
      checks.push({ id: `${row[1]}${row[2]}`, section: key, text: row[3]!.trim(), method: row[4] as CheckMethod, major: row[5] === "M" })
    }
  }
  const ids = new Set(checks.map(check => check.id))
  if (ids.size !== checks.length) throw new Error("RUBRIC.md has a duplicate check id.")
  return { sections, checks, header: markdown.slice(0, headings[0]?.index ?? 0).replace(/\n---\s*$/, "").trim(), sectionText }
}
