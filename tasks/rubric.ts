import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { CheckMethod, Rubric, RubricCheck, RubricSection } from "../site/shared/rubric.ts"

/** A project's RUBRIC.md, such as `tasks/meetups/RUBRIC.md`. */
export const rubricFile = (project: string) => join(import.meta.dirname, project, "RUBRIC.md")

/**
 * A project's RUBRIC.md as data. RUBRIC.md stays the one source: sections are `## N. Title`, checks are table rows `| P1 | text | run | M |`,
 * and the Markdown links of a section's `Sources:` line are its docs. Sections titled `ViteHub...` form the ViteHub part
 * of the headline.
 */
export function readRubric(project: string, markdown = readFileSync(rubricFile(project), "utf8")): Rubric & { header: string, sectionText: Map<string, string> } {
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
    const docs = [...(body.match(/^Sources: (.+)$/m)?.[1] ?? "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map(link => ({ label: link[1]!, url: link[2]! }))
    const title = heading[2]!.trim()
    sections.push({ key, number: Number(heading[1]), title, part: title.startsWith("ViteHub") ? "vitehub" : "general", ...(docs.length ? { docs } : {}) })
    sectionText.set(key, body)
    for (const row of rows) {
      if (row[1] !== key) throw new Error(`Check ${row[1]}${row[2]} sits in section ${key}.`)
      checks.push({ id: `${row[1]}${row[2]}`, section: key, text: row[3]!.trim(), method: row[4] as CheckMethod, major: row[5] === "M" })
    }
  }
  const ids = new Set(checks.map(check => check.id))
  if (ids.size !== checks.length) throw new Error("RUBRIC.md has a duplicate check id.")
  const header = markdown.slice(0, headings[0]?.index ?? 0).replace(/\n---\s*$/, "").trim()
  // `Gate: F1, F2` and `Weights: R 20, S 30` lines in the header (fix projects).
  const gate = header.match(/^Gate: (.+)$/m)?.[1]?.split(/[,\s]+/).filter(Boolean)
  for (const id of gate ?? []) if (!ids.has(id)) throw new Error(`RUBRIC.md's gate names ${id}, which isn't a check.`)
  const weightLine = header.match(/^Weights: (.+)$/m)?.[1]
  const weights = weightLine ? Object.fromEntries(weightLine.split(",").map(part => part.trim().split(/\s+/)).map(([key, value]) => [key!, Number(value)])) : undefined
  for (const key of Object.keys(weights ?? {})) if (!sections.some(section => section.key === key)) throw new Error(`RUBRIC.md's weights name section ${key}, which doesn't exist.`)
  return { sections, checks, ...(gate?.length ? { gate } : {}), ...(weights ? { weights } : {}), header, sectionText }
}
