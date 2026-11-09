import type { RubricGrade, SectionScore } from "#shared/rubric"

/** `[text](url)` → text, `**bold**` → bold. Backticks stay for InlineCode. */
export const plainCheck = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1")

/** 4.35 → "4.4" */
export const fiveScale = (score: number | null | undefined) => score === null || score === undefined || !Number.isFinite(score) ? "–" : score.toFixed(1).replace(/\.0$/, "")

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
