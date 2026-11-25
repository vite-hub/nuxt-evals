import type { CheckSource, RubricGrade, RubricLink, SectionScore } from "#shared/rubric"

/** `[text](url)` → text, `**bold**` → bold. Backticks stay for InlineCode. */
export const plainCheck = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1")

/** The Markdown links in a check's text, which `plainCheck` drops: the check's own "see". */
export const checkLinks = (text: string): RubricLink[] => [...text.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)].map(match => ({ label: match[1]!.replaceAll("`", ""), url: match[2]! }))

/** The app a check's sources point into: how to read its files, and where a source opens in its Files surface. */
export interface CodeOrigin {
  /** Tells apart the files of different apps in the cache, such as `run:<id>` or `project:<name>`. */
  key: string
  read: (path: string) => Promise<string>
  href: (source: CheckSource) => string
  /** Opens the source in place, on the page that owns it. Without it the link opens a new tab. */
  open?: (source: CheckSource) => void
}

/** `app/pages/index.vue:6-9` */
export const sourceLabel = (source: CheckSource) => `${source.path}:${source.line}${source.endLine && source.endLine !== source.line ? `-${source.endLine}` : ""}`

/** `?file=<path>&line=6-9`, the query the Files surfaces read. Line 0 is the file without a line: `?file=<path>`. */
export const sourceQuery = (source: CheckSource) => new URLSearchParams({ file: source.path, ...(source.line ? { line: `${source.line}${source.endLine && source.endLine !== source.line ? `-${source.endLine}` : ""}` } : {}) }).toString()

/** The `file` and `line` of a page's query, as a place to open in its Files surface. */
export function queriedSource(query: Record<string, unknown>): CheckSource | undefined {
  const path = typeof query.file === "string" ? query.file : undefined
  if (!path) return undefined
  const [line, endLine] = String(query.line ?? "").split("-").map(Number)
  return { path, line: Number.isInteger(line) && line! > 0 ? line! : 0, ...(Number.isInteger(endLine) && endLine! > 0 ? { endLine } : {}) }
}

const files = new Map<string, Promise<string>>()

/** Reads each file once, however many checks cite it. A failed read is tried again next time. */
export function readSource(origin: CodeOrigin, path: string): Promise<string> {
  const key = `${origin.key}:${path}`
  let file = files.get(key)
  if (!file) {
    file = origin.read(path)
    file.catch(() => files.delete(key))
    files.set(key, file)
  }
  return file
}

const languages: Record<string, string> = { vue: "vue", ts: "typescript", mts: "typescript", cts: "typescript", tsx: "tsx", js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx", json: "json", css: "css", sql: "sql", md: "markdown", yaml: "yaml", yml: "yaml", html: "html", sh: "bash" }

/** The highlighter's language for a file, or `text` when it has none. */
export const languageOf = (path: string) => languages[path.split(".").pop()?.toLowerCase() ?? ""] ?? "text"

/** A code fence's language, written as a name (`typescript`) or an extension (`ts`). */
export const fenceLanguage = (name: string) => languages[name.toLowerCase()] ?? (name.toLowerCase() || "text")

/** A fix's Markdown as text paragraphs and fenced code blocks, all a fix holds. */
export function fixParts(markdown: string): ({ type: "text", text: string } | { type: "code", code: string, language: string })[] {
  const parts: ({ type: "text", text: string } | { type: "code", code: string, language: string })[] = []
  const text = (value: string) => {
    for (const paragraph of value.split(/\n\s*\n/)) if (paragraph.trim()) parts.push({ type: "text", text: paragraph.trim().replace(/\s*\n\s*/g, " ") })
  }
  let last = 0
  for (const match of markdown.matchAll(/^```([\w-]*)[^\n]*\n([\s\S]*?)^```\s*$/gm)) {
    text(markdown.slice(last, match.index))
    parts.push({ type: "code", code: match[2]!.replace(/\n$/, ""), language: match[1] || "text" })
    last = match.index + match[0].length
  }
  text(markdown.slice(last))
  return parts
}

/** A 0-to-10 score with one decimal: 4.35 → "4.4", 4.05 → "4.1" (rounded before toFixed, which reads 4.05 as 4.0499…), 10 → "10". */
/** A score as the site shows it: grades are stored from 0 to 10 with one decimal, and read as 0 to 100 (7.6 → "76"). */
export const scoreText = (score: number | null | undefined) => score === null || score === undefined || !Number.isFinite(score) ? "–" : String(Math.round(score * 10))

export function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/** Section scores of several runs, as one median per section. */
export function medianSections(grades: RubricGrade[]): Pick<SectionScore, "key" | "score">[] {
  const keys = grades[0]?.sections.map(section => section.key) ?? []
  return keys.map(key => ({ key, score: median(grades.map(grade => grade.sections.find(section => section.key === key)?.score ?? Number.NaN)) }))
}
