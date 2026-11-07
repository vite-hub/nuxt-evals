import { createError, defineEventHandler, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { blob } from "vite-hub/blob"
import { useDatabase } from "vite-hub/database/drizzle"
import type { RunDetail, RunReport } from "../../../shared/report"

export default defineEventHandler(async (event): Promise<RunDetail> => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ status: 400, message: "Missing run id." })
  const { db, schema } = useDatabase("default")
  const [row] = await db.select().from(schema.runs).where(eq(schema.runs.id, id))
  if (!row) throw createError({ status: 404, message: "Run not found." })

  const [error, file] = await blob.get(`runs/${id}.json`)
  if (error) throw error
  const artifacts = file ? JSON.parse(await file.text()) as Pick<RunReport, "events" | "diff" | "files"> : { events: [], diff: "", files: [] }
  return { ...(row as Omit<RunReport, "events" | "diff" | "files">), ...artifacts }
})
