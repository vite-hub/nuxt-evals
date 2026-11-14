import { defineDatabase } from "vite-hub/database"
import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
})

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

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  city: text("city").notNull(),
  venue: text("venue").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  timeZone: text("time_zone").notNull(),
  capacity: integer("capacity").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
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
  confirmationSentAt: integer("confirmation_sent_at", { mode: "timestamp_ms" }),
  reminderSentAt: integer("reminder_sent_at", { mode: "timestamp_ms" }),
}, t => [
  uniqueIndex("rsvps_event_user_idx").on(t.eventId, t.userId),
  index("rsvps_user_idx").on(t.userId),
])

export default defineDatabase({
  schema: { events, rsvps, passkey },
})
