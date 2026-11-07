import { defineEventHandler, readBody } from "h3"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database/drizzle"
import type { RunReport } from "../../shared/report"
import { requireIngestToken } from "../utils/ingest"

export default defineEventHandler(async (event) => {
  requireIngestToken(event)
  const report = await readBody<RunReport>(event)
  if (!report?.id) throw new Error("A run report needs an id.")

  const { events, diff, files, ...summary } = report
  const [error] = await blob.put(`runs/${report.id}.json`, JSON.stringify({ events, diff, files }), { contentType: "application/json" })
  if (error) throw error

  const { db, schema } = useDatabase("default")
  await db.insert(schema.runs).values(summary).onConflictDoUpdate({ target: schema.runs.id, set: summary })
  return { id: report.id }
})
