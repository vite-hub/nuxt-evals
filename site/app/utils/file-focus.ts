import type { CheckSource } from "#shared/rubric"

/** The lines a source names, as the file viewer's selection. */
export const selectedLines = (source?: CheckSource) => source?.line ? { start: source.line, end: Math.max(source.endLine ?? source.line, source.line) } : undefined
