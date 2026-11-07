import { defineHandler } from "h3"
import { desc } from "drizzle-orm"
import { useDatabase } from "vite-hub/database/drizzle"

/** Every run is one workspace: the files the agent left behind. */
export default defineHandler(async () => {
  const { db, schema } = useDatabase("default")
  const rows = await db.select({
    id: schema.runs.id,
    task: schema.runs.task,
    model: schema.runs.model,
    setup: schema.runs.setup,
    status: schema.runs.status,
    startedAt: schema.runs.startedAt,
  }).from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(500)
  return rows
})
