import { defineEventHandler } from "h3"
import { desc } from "drizzle-orm"
import { useDatabase } from "vite-hub/database/drizzle"
import type { RubricGrade } from "../../shared/rubric"

/** Every run for the results page. Rubric evidence stays on the run page: the list keeps each check's outcome only. */
export default defineEventHandler(async () => {
  const { db, schema } = useDatabase("default")
  const rows = await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(500)
  return rows.map((row) => {
    const rubric = row.rubric as RubricGrade | null
    if (!rubric) return row
    return { ...row, rubric: { ...rubric, setupNotes: undefined, checks: rubric.checks.map(check => ({ id: check.id, outcome: check.outcome, evidence: "" })) } }
  })
})
