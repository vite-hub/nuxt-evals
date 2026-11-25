import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { test } from "node:test"
import { createAuthConsole } from "@vite-hub/auth/console-runtime"
import { betterAuth } from "better-auth"

const migrations = new URL("../server/databases/default/migrations/", import.meta.url)
const ledger = JSON.parse(readFileSync(new URL("d1-migrations.json", migrations), "utf8")) as Record<string, string>
const snakeCaseFields = (fields: string) => Object.fromEntries(fields.split(" ").map(field => [
  field, field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
]))

test("upgrade signs out untracked guests and keeps owned guests revocable", async () => {
  using database = new DatabaseSync(":memory:")
  const auth = betterAuth({
    database,
    baseURL: "http://localhost:4791",
    secret: "local-site-access-migration-test-only",
    user: {
      fields: snakeCaseFields("emailVerified createdAt updatedAt"),
      additionalFields: { role: { type: "string", input: false, required: false } },
    },
    session: { fields: snakeCaseFields("userId expiresAt createdAt updatedAt ipAddress userAgent") },
    account: {
      fields: snakeCaseFields("userId accountId providerId accessToken refreshToken idToken accessTokenExpiresAt refreshTokenExpiresAt createdAt updatedAt"),
    },
    verification: { fields: snakeCaseFields("expiresAt createdAt updatedAt") },
  })
  const consoleAuth = createAuthConsole(auth)
  const context = await auth.$context
  const request = new Request("http://localhost:4791/")
  const migrate = (steps: string[]) => {
    for (const step of steps) {
      const sql = readFileSync(new URL(`${step}/migration.sql`, migrations), "utf8")
      for (const statement of sql.split("--> statement-breakpoint")) database.exec(statement)
    }
  }
  const steps = Object.keys(ledger).sort((left, right) => ledger[left].localeCompare(ledger[right]))
  const upgrade = steps.findIndex(step => step.endsWith("_revoke_untracked_guest_sessions"))
  assert.ok(upgrade > 0)
  migrate(steps.slice(0, upgrade))

  const hostSession = async (userId: string) => {
    const [error, headers] = await consoleAuth.hostSession(userId, request)
    assert.ifError(error)
    return new Headers({ cookie: headers!.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ") })
  }
  const legacy = await context.internalAdapter.createUser({ name: "Legacy guest", email: "legacy@guests.invalid", role: "guest,comments-read" })
  const owner = await context.internalAdapter.createUser({ name: "Site owner", email: "owner@example.com" })
  const [guestError, tracked] = await consoleAuth.hostUser({ name: "Tracked guest", roles: ["guest", "comments-read"] })
  assert.ifError(guestError)
  const legacyHeaders = await hostSession(legacy.id)
  const ownerHeaders = await hostSession(owner.id)
  const trackedHeaders = await hostSession(tracked!.id)
  assert.equal((await auth.api.getSession({ headers: legacyHeaders }))?.user.role, "guest,comments-read")
  const [listError, before] = await consoleAuth.hostSessions(["guest"])
  assert.ifError(listError)
  assert.deepEqual(before?.map(session => session.user.id), [tracked!.id])

  migrate(steps.slice(upgrade))

  assert.equal(await auth.api.getSession({ headers: legacyHeaders }), null)
  assert.equal((await context.internalAdapter.findUserById(legacy.id))?.id, legacy.id)
  assert.equal((await auth.api.getSession({ headers: ownerHeaders }))?.user.id, owner.id)
  assert.equal((await auth.api.getSession({ headers: trackedHeaders }))?.user.id, tracked!.id)
  assert.ok((await consoleAuth.hostSession(legacy.id, request))[0])
  const [freshError, fresh] = await consoleAuth.hostUser({ name: "New guest", roles: ["guest", "comments-read"] })
  assert.ifError(freshError)
  const freshHeaders = await hostSession(fresh!.id)
  const [afterListError, after] = await consoleAuth.hostSessions(["guest"])
  assert.ifError(afterListError)
  const freshSession = after?.find(session => session.user.id === fresh!.id)
  assert.ok(freshSession)
  assert.ifError((await consoleAuth.revokeHostSession(freshSession.id))[0])
  assert.equal(await auth.api.getSession({ headers: freshHeaders }), null)
})
