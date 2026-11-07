import { defineEventHandler } from "h3"
import { desc } from "drizzle-orm"
import { useDatabase } from "vite-hub/database/drizzle"

export default defineEventHandler(async () => {
  const { db, schema } = useDatabase("default")
  return await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(500)
})
