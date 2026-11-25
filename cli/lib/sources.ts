// Turns the places a judge cites in an app's code into CheckSource entries the site can link to. The judge reads the app
// in a temp folder and can misremember a path or a line number, so every place is checked against the saved files.
import type { RunFile } from "../../site/shared/report.ts"
import type { CheckSource } from "../../site/shared/rubric.ts"

/** A place as the judge reports it. `quote` is the exact text of the first cited line. */
export interface RawSource {
  path: string
  line: number
  endLine?: number
  quote?: string
}

/** The file a cited path names: an exact path, a unique suffix such as `rsvp.post.ts`, or an absolute path into the temp app. */
function findFile(files: RunFile[], cited: string): RunFile | string {
  const path = cited.trim().replace(/^\.\//, "")
  const exact = files.find(file => file.path === path)
  if (exact) return exact
  const bySuffix = files.filter(file => file.path.endsWith(`/${path}`))
  if (bySuffix.length === 1) return bySuffix[0]!
  if (bySuffix.length > 1) return `${cited} matches ${bySuffix.length} files`
  const inside = files.filter(file => path.endsWith(`/${file.path}`)).sort((a, b) => b.path.length - a.path.length)
  if (inside[0]) return inside[0]
  return `${cited} is not in the app`
}

/** One place, checked and moved to where its quote is; or why it was dropped. */
export function resolveSource(files: RunFile[], raw: RawSource): CheckSource | string {
  const file = findFile(files, raw.path)
  if (typeof file === "string") return file
  const lines = file.content.split("\n")
  if (lines.length > 1 && lines.at(-1) === "") lines.pop()
  if (!Number.isInteger(raw.line)) return `${file.path}: line ${raw.line} is not a line number`
  const span = Number.isInteger(raw.endLine) && raw.endLine! > raw.line ? raw.endLine! - raw.line : 0
  let line = raw.line
  const quote = raw.quote?.split("\n").find(text => text.trim())?.trim()
  const matches = quote ? lines.flatMap((text, index) => text.trim().includes(quote) ? [index + 1] : []) : []
  if (matches.length) line = matches.reduce((best, candidate) => Math.abs(candidate - raw.line) < Math.abs(best - raw.line) ? candidate : best)
  else if (line < 1 || line > lines.length) return `${file.path}:${raw.line} is outside the file (${lines.length} lines)${quote ? " and the quote is not in it" : ""}`
  const endLine = Math.min(line + span, lines.length)
  return { path: file.path, line, ...(endLine > line ? { endLine } : {}) }
}

/** The places that exist in `files`, de-duplicated. Places that name no file, or no line in it, are dropped. */
export function resolveSources(files: RunFile[], raw: RawSource[]): CheckSource[] {
  const seen = new Set<string>()
  const sources: CheckSource[] = []
  for (const entry of raw) {
    const source = resolveSource(files, entry)
    if (typeof source === "string") continue
    const key = `${source.path}:${source.line}-${source.endLine ?? source.line}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push(source)
  }
  return sources
}
