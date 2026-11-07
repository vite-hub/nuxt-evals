import { createError, defineHandler, getRouterParam } from "h3"
import { eq } from "drizzle-orm"
import { useDatabase } from "vite-hub/database/drizzle"
import type { RunSummary } from "../../../shared/report"
import { content } from "../../content"

/** One run: its row and its published Comark summary from the `runs` collection. */
export default defineHandler(async (event): Promise<{ run: RunSummary, summary: string | null }> => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ status: 400, message: "Missing run id." })
  const { db, schema } = useDatabase("default")
  const [row] = await db.select().from(schema.runs).where(eq(schema.runs.id, id))
  if (!row) throw createError({ status: 404, message: "Run not found." })
  const document = await content.collection("runs").get(id)
  return { run: row as RunSummary, summary: document?.body ?? null }
})
