import { defineHandler } from "h3"
import { useDatabase } from "vite-hub/database/drizzle"
import { sql } from "drizzle-orm"

/** Whether the one account exists yet, so /sign-in offers sign-up only before it does. */
export default defineHandler(async () => {
  const { db } = useDatabase("default")
  const row = await db.get<{ n: number }>(sql`select count(*) as n from user`)
  return { open: !row?.n }
})
