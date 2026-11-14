import type { FixtureEdit, Task } from "../types.ts"
import findings from "./findings.ts"

/**
 * Corpus Type B starter (research/corpus/report-b-hidden-bugs.md): the Meetups app with 12 planted bugs among correct
 * code that looks wrong (the decoys). The agent reviews it without running it and writes findings.json; the judge
 * grades the file against RUBRIC.md, from the code alone.
 */
const edits: FixtureEdit[] = [
  // AU7, read form: the attendee list checks that someone is signed in, not that they organize the event.
  {
    path: "server/api/events/[slug]/attendees.get.ts",
    find: `import { findOwnedEvent, listAttendees } from "#server/utils/events"`,
    replace: `import { findEventBySlug, listAttendees } from "#server/utils/events"`,
  },
  {
    path: "server/api/events/[slug]/attendees.get.ts",
    find: `  const user = await requireUser(event)
  const found = await findOwnedEvent(getRouterParam(event, "slug")!, user.id)`,
    replace: `  await requireUser(event)
  const found = await findEventBySlug(getRouterParam(event, "slug")!)`,
  },

  // SEC1: the edit route spreads the raw body into the update.
  {
    path: "server/api/events/[slug]/index.patch.ts",
    find: `import { createError, defineEventHandler, getRouterParam, readValidatedBody } from "nuxt/server"
import { eventInputSchema } from "#shared/schemas/event"`,
    replace: `import { createError, defineEventHandler, getRouterParam, readBody } from "nuxt/server"
import type { EventInput } from "#shared/schemas/event"`,
  },
  {
    path: "server/api/events/[slug]/index.patch.ts",
    find: `await readValidatedBody(event, eventInputSchema)`,
    replace: `await readBody<EventInput>(event)`,
  },

  // KV5: the event page is cached by slug, but the cached value holds the visitor's RSVP and organizer flag.
  {
    path: "server/api/events/[slug]/index.get.ts",
    content: `import { eq } from "drizzle-orm"
import { defineCachedFunction } from "nitro/cache"
import { defineEventHandler, getRouterParam } from "nuxt/server"
import { db } from "vite-hub/database/drizzle"
import { users } from "#server/databases/config"
import { findEventBySlug, isGoing, seatsLeft } from "#server/utils/events"
import { getSessionUser } from "#server/utils/session"

const eventPage = defineCachedFunction(async (slug: string, userId: string | null) => {
  const found = await findEventBySlug(slug)
  const [[organizer], left, going] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, found.organizerId)).limit(1),
    seatsLeft(found.id),
    userId ? isGoing(found.id, userId) : false,
  ])

  return {
    slug: found.slug,
    title: found.title,
    description: found.description,
    city: found.city,
    venue: found.venue,
    startsAt: found.startsAt,
    timeZone: found.timeZone,
    capacity: found.capacity,
    priceCents: found.priceCents,
    coverPath: found.coverPath,
    organizerName: organizer!.name,
    seatsLeft: left,
    going,
    isOrganizer: userId === found.organizerId,
  }
}, { name: "event-page", maxAge: 60, getKey: (slug: string) => slug })

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  const page = await eventPage(getRouterParam(event, "slug")!, user?.id ?? null)
  return { ...page, started: new Date(page.startsAt).getTime() <= Date.now() }
})
`,
  },

  // SSR1, app form: the signed-in user lives in a module-scope ref, shared by every request the server renders.
  {
    path: "app/composables/useAuth.ts",
    find: `export function useAuth() {
  const user = useState<SessionUser | null>("auth:user", () => null)
`,
    replace: `const user = ref<SessionUser | null>(null)

export function useAuth() {
`,
  },

  // EN2: the rates key moves to public runtime config and the plugin calls the provider itself.
  {
    path: "nuxt.config.ts",
    find: `    rates: {
      url: "https://api.frankfurter.dev/v1/latest",
      apiKey: "",
    },
    mail: {`,
    replace: `    mail: {`,
  },
  {
    path: "nuxt.config.ts",
    find: `    public: {
      siteUrl: "",
    },`,
    replace: `    public: {
      siteUrl: "",
      rates: {
        url: "https://api.frankfurter.dev/v1/latest",
        apiKey: "",
      },
    },`,
  },
  {
    path: ".env.example",
    find: `NUXT_RATES_URL=https://api.frankfurter.dev/v1/latest
NUXT_RATES_API_KEY=`,
    replace: `NUXT_PUBLIC_RATES_URL=https://api.frankfurter.dev/v1/latest
NUXT_PUBLIC_RATES_API_KEY=`,
  },
  {
    path: "app/plugins/rates.ts",
    content: `export default defineNuxtPlugin({
  name: "rates",
  parallel: true,
  async setup() {
    const rates = useState<Rates | null>("rates", () => null)
    const { rates: provider } = useRuntimeConfig().public
    await callOnce("rates", async () => {
      try {
        const { rates: latest } = await $fetch<{ rates: Pick<Rates, "USD" | "GBP"> }>(provider.url, {
          query: { base: "EUR", symbols: "USD,GBP" },
          headers: provider.apiKey ? { authorization: \`Bearer \${provider.apiKey}\` } : {},
          timeout: 1500,
          retry: 0,
        })
        rates.value = { EUR: 1, ...latest }
      }
      catch (error) {
        console.error("Exchange rates unavailable", error)
      }
    })
  },
})
`,
  },
  { path: "server/api/rates.get.ts", remove: true },

  // SEC2: sign-in follows ?redirect= as an external URL. DC2: sign-up follows it without \`external\`, which is safe.
  {
    path: "app/pages/sign-in.vue",
    find: `const redirectTo = computed(() => safeRedirect(route.query.redirect))`,
    replace: `const redirectTo = computed(() => (route.query.redirect as string | undefined) || "/")`,
  },
  {
    path: "app/pages/sign-in.vue",
    find: `    await navigateTo(redirectTo.value, { replace: true })`,
    replace: `    await navigateTo(redirectTo.value, { replace: true, external: true })`,
  },
  {
    path: "app/pages/sign-up.vue",
    find: `const redirectTo = computed(() => safeRedirect(route.query.redirect))

`,
    replace: "",
  },
  {
    path: "app/pages/sign-up.vue",
    find: `    await navigateTo(redirectTo.value, { replace: true })`,
    replace: `    await navigateTo(String(route.query.redirect || "/"), { replace: true })`,
  },
  { path: "app/utils/redirect.ts", remove: true },

  // BL2: the cover upload accepts any declared image type, SVG included, and stores the declared type.
  {
    path: "server/api/events/[slug]/cover.put.ts",
    find: `import { detectContentType } from "vite-hub/blob/content-type"
`,
    replace: "",
  },
  {
    path: "server/api/events/[slug]/cover.put.ts",
    find: `import { COVER_MAX_BYTES, COVER_MAX_MB, COVER_TYPES } from "#shared/utils/cover"`,
    replace: `import { COVER_MAX_BYTES, COVER_MAX_MB } from "#shared/utils/cover"`,
  },
  {
    path: "server/api/events/[slug]/cover.put.ts",
    find: `  ensureBlob(file, { maxSize: \`\${COVER_MAX_MB}MB\`, types: [...COVER_TYPES] })
  const type = detectContentType(new Uint8Array(await file.slice(0, 64).arrayBuffer()))
  if (type !== file.type) throw createError({ status: 400, statusText: "That file isn't a JPEG, PNG or WebP photo." })

  const [putError, stored] = await blob.put(\`covers/\${found.id}/cover\`, file, { contentType: type, addRandomSuffix: true })`,
    replace: `  ensureBlob(file, { maxSize: \`\${COVER_MAX_MB}MB\`, types: ["image"] })

  const [putError, stored] = await blob.put(\`covers/\${found.id}/cover\`, file, { contentType: file.type, addRandomSuffix: true })`,
  },

  // AU5: the request's origin wins over the configured one, so reset links follow the Host header.
  {
    path: "server/auth.ts",
    find: `  const origin = siteUrl || requestOrigin`,
    replace: `  const origin = requestOrigin || siteUrl`,
  },

  // DB1: the RSVP reads the free seats, awaits, then inserts (the same plant as fix-seats-race).
  {
    path: "server/api/events/[slug]/rsvp.post.ts",
    content: `import { and, eq } from "drizzle-orm"
import { createError, defineEventHandler, getRouterParam } from "nuxt/server"
import { db, schema } from "vite-hub/database/drizzle"
import { runQueue } from "vite-hub/queue"
import { requireRateLimit } from "vite-hub/rate-limit"
import { findEventBySlug, seatsLeft } from "#server/utils/events"
import { requireUser } from "#server/utils/session"

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await requireRateLimit(event.req, "rsvp", { limit: 20, window: "1m", key: user.id })
  const found = await findEventBySlug(getRouterParam(event, "slug")!)
  const { rsvps } = schema

  if (found.startsAt.getTime() <= Date.now()) {
    throw createError({ status: 409, statusText: "This event has already started." })
  }

  const [already] = await db.select({ id: rsvps.id }).from(rsvps)
    .where(and(eq(rsvps.eventId, found.id), eq(rsvps.userId, user.id))).limit(1)
  if (already) return { going: true, seatsLeft: await seatsLeft(found.id) }

  if (await seatsLeft(found.id) <= 0) {
    throw createError({ status: 409, statusText: "Sorry, the last seat just went." })
  }

  const [inserted] = await db.insert(rsvps).values({ eventId: found.id, userId: user.id })
    .onConflictDoNothing()
    .returning({ id: rsvps.id })

  if (inserted) {
    const [error] = await runQueue("rsvp-confirmation", { rsvpId: inserted.id }, { idempotencyKey: \`rsvp-confirmation:\${inserted.id}\` })
    if (error) console.error(\`Confirmation for RSVP \${inserted.id} not queued\`, error)
  }

  return { going: true, seatsLeft: await seatsLeft(found.id) }
})
`,
  },
  {
    path: "server/utils/events.ts",
    find: "left: sql<number>`max(${events.capacity} - (select count(*) from ${rsvps} where ${rsvps.eventId} = ${eventId}), 0)`,",
    replace: "left: sql<number>`${events.capacity} - (select count(*) from ${rsvps} where ${rsvps.eventId} = ${eventId})`,",
  },

  // Q1, logged form: a failed confirmation or reminder is logged, the claim stays set and the job succeeds.
  {
    path: "server/utils/mail.ts",
    find: `  if (error) {
    console.error(\`The \${kind} for RSVP \${rsvpId} wasn't sent: \${error.code}\`, error)
    await db.update(rsvps).set(mark(null)).where(eq(rsvps.id, rsvpId))
    throw error
  }`,
    replace: `  if (error) console.error(\`The \${kind} for RSVP \${rsvpId} wasn't sent: \${error.code}\`, error)`,
  },

  // SEC8: CSV cells are quoted but no longer defused, so a name like =HYPERLINK(...) runs as a formula.
  {
    path: "server/api/events/[slug]/attendees.csv.get.ts",
    find: `  const safe = /^[=+\\-@\\t\\r]/.test(value) ? \`'\${value}\` : value
  return \`"\${safe.replaceAll("\\"", "\\"\\"")}"\``,
    replace: `  return \`"\${value.replaceAll("\\"", "\\"\\"")}"\``,
  },

  // DB9: a case-insensitive city filter wraps the column in lower(), so events_city_starts_at_idx can't serve it.
  {
    path: "server/api/events/index.get.ts",
    find: `    city ? eq(events.city, city) : undefined,`,
    replace: "    city ? sql`lower(${events.city}) = lower(${city})` : undefined,",
  },
]

const task: Task = {
  id: "scan-meetups",
  title: "Hidden bugs",
  kind: "scan",
  rubric: true,
  probes: [],
  timeLimitMinutes: 45,
  plant: {
    base: "meetups/base",
    edits,
    reference: [{ path: "findings.json", content: `${JSON.stringify(findings, null, 2)}\n` }],
  },
  judge: {
    static: true,
    groups: [
      { name: "findings", sections: ["G", "H", "L", "E", "N"] },
      { name: "decoys", sections: ["D"] },
    ],
    setupChecks: [],
    build: "",
    setupGrading: () => "",
    sharedServer: () => "Nothing runs for this project: don't install, build or start the app. Grade from the app's files, its findings.json and the agent's session log.",
    rules: (app, scratch) => [
      "Grade the findings in findings.json against the planted bugs and the decoys the rubric lists, from the code. Accept every correct way to describe a bug: a finding matches a plant when it points at the plant's file (or a second file the check names) at a line within 10 of the planted line or in the same function, and gives the same mechanism in any words. Any fix that would work counts, not only the one the rubric names. Never grade the wording, the order of fields or the title alone.",
      `Read the code in ${app} to confirm what a finding claims. You may write notes in ${scratch}, but don't run, install or build anything.`,
      "One finding matches at most one plant, and a plant counts once however many findings describe it. Findings after the 25th don't count, for or against.",
      "A real bug the rubric doesn't list is neither a plant nor noise: it doesn't count against N1. Name it and its finding in N1's evidence so a person can confirm it.",
      "A finding that only restates a plant's symptom without its cause (\"the list may leak\", \"possible race\") doesn't match.",
      "If findings.json is missing or not the asked shape, G1 fails, and the other checks are graded from whatever list the agent left (findings.json in another place or shape, or its final message), so the evidence still says what it found.",
    ],
    apis: "Nuxt 5, Nitro v3, h3 v2, Vue, Better Auth, Drizzle or ViteHub",
  },
}

export default task
