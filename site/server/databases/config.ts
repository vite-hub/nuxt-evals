import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { defineDatabase } from "vite-hub/database"

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  suite: text("suite").notNull(),
  project: text("project").notNull(),
  harness: text("harness").notNull(),
  model: text("model").notNull(),
  reasoning: text("reasoning").notNull(),
  setup: text("setup").notNull(),
  repeat: integer("repeat").notNull(),
  status: text("status").notNull(),
  score: real("score").notNull(),
  startedAt: text("started_at").notNull(),
  durationMs: integer("duration_ms").notNull(),
  usage: text("usage", { mode: "json" }).notNull(),
  probes: text("probes", { mode: "json" }).notNull(),
  diagnostics: text("diagnostics", { mode: "json" }).notNull(),
  finalText: text("final_text").notNull(),
  /** The Opus judge's grade against the project's RUBRIC.md (`RubricGrade`), for rubric projects. */
  rubric: text("rubric", { mode: "json" }),
  /** Journal record id of the run's Agent session, for the Console link. */
  invocation: text("invocation"),
})

/**
 * Better Auth's passkey plugin table. `authDatabase()` adds the core Auth tables itself; a plugin table goes here, with
 * Better Auth's field names as keys and snake_case columns like the ones `authDatabase()` writes.
 */
export const passkey = sqliteTable("passkey", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id").notNull(),
  credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
  transports: text("transports"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  aaguid: text("aaguid"),
}, table => [index("passkey_userId_idx").on(table.userId), index("passkey_credentialID_idx").on(table.credentialID)])

export default defineDatabase({
  cloudflare: { binding: "DB", databaseName: "nuxt-evals", databaseId: "20cf6284-895d-4737-8e2b-d30f9a2328ae" },
  schema: { runs, passkey },
})
