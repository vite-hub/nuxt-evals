import { defineDatabase } from "vite-hub/database"
import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/**
 * Auth owns the `user` table and adds it, with session, account and the rest, to this Database through
 * authDatabase() in server/auth.ts. This typed view of the columns we read lets queries and foreign keys use it.
 * It stays out of `schema` below, so the migration doesn't create the table twice.
 */
export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
})

/**
 * Better Auth's passkey plugin keeps credentials in this table. authDatabase() adds only the core Auth tables, so a
 * plugin's table belongs to the app's Database: Better Auth's field names as keys, snake_case columns like Auth's own.
 */
export const passkey = sqliteTable("passkey", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
  transports: text("transports"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  aaguid: text("aaguid"),
}, t => [
  index("passkey_user_id_idx").on(t.userId),
  uniqueIndex("passkey_credential_id_idx").on(t.credentialID),
])

const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date())

// The numeric id keeps the old /e/<id> links working; the slug is the public address.
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  city: text("city").notNull(),
  venue: text("venue").notNull(),
  // An instant in UTC. `timeZone` is where the event happens, for "18:30 local time".
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  timeZone: text("time_zone").notNull(),
  capacity: integer("capacity").notNull(),
  // Euro cents. 0 means free.
  priceCents: integer("price_cents").notNull().default(0),
  // The cover photo's path in the Blob store (served at /images/<path>), or null.
  coverPath: text("cover_path"),
  organizerId: text("organizer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [
  index("events_starts_at_idx").on(t.startsAt),
  index("events_city_starts_at_idx").on(t.city, t.startsAt),
  index("events_organizer_idx").on(t.organizerId),
])

export const rsvps = sqliteTable("rsvps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  // Set by the mail jobs when they take the message, so a retried or repeated job never sends it twice.
  confirmationSentAt: integer("confirmation_sent_at", { mode: "timestamp_ms" }),
  reminderSentAt: integer("reminder_sent_at", { mode: "timestamp_ms" }),
}, t => [
  // One seat per person per event, enforced by the database, not by a check-then-insert.
  uniqueIndex("rsvps_event_user_idx").on(t.eventId, t.userId),
  index("rsvps_user_idx").on(t.userId),
])

export default defineDatabase({
  // `passkey` under its Better Auth model name: the Auth adapter finds the plugin table by that key.
  schema: { events, rsvps, passkey },
})
