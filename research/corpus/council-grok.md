# Council seat 3 (written by Opus 5.5 in Grok's seat): known-issue fix and hidden-bug corpus

Lens: Type B (static hidden-bug detection), plus Type A cases for security and concurrency. 47 cases.

Source tags: **[V]** I read it in the file at path:line. **[R]** a real commit, PR or run record. **[G]** my guess, not checked. ViteHub paths are at `1e807fc9`, the commit the Meetups reference pins (`tasks/meetups/reference/package.json`). The local checkout's HEAD is older (Oct 11), so I read that commit with `git show`.

**Real evidence from our own runs.** `cli/.data/runs` and `cli/.data/archive` hold 15 graded Meetups v2 runs (Codex and Claude Code). These are bugs that agents really wrote, with the share of runs that failed each check [R]:
- H5 `Date.now()` decides first paint: 12/15
- C2 a slow rates service breaks the page: 12/15
- C8 public data not cached: 12/15
- A7 rate limit in one shared bucket or keyed on a spoofable header: 8/15
- B6 capacity race: 7/15
- B13 lowering the seats races: 7/15
- T1 venue time read in the server's zone: 7/15
- B8 index defeated by `lower(city)`: 7/15
- B11 no SQL pagination: 6/15
- B12 LIKE wildcards not escaped: 6/15
- A4 organizer-only routes: 4/15
- S1 user missing from SSR: 4/15

The low security fail rates (A3 2/15, A8 1/15, X1 0/15) say greenfield agents mostly write auth correctly when they write it from scratch. That is why Type B plants the bugs into code the agent did not write.

---

## Scoring, matching, fixture strategy

**Type A (fix).** Gate: the hidden reproduction test passes and the hidden regression suite stays green. A run that fails the gate scores 0 on quality, and we still report its time and cost. Quality over 10:
- Root cause named and fixed at the right layer: 25
- Solution class (best 1.0, acceptable 0.7, over-engineered 0.4, masks-symptom 0.1, wrong 0): 25
- Minimality (lines and files compared with the best fix, no drive-by changes): 15
- Right ViteHub or framework primitive, nothing hand-rolled: 15
- The agent's own verification (it reproduced the bug before fixing, or added a test that fails without the fix): 10
- No collateral (Vite Doctor delta, typecheck, unrelated behaviour): 10

Time, tokens and cost stay out of quality. We show them beside it, plus quality per dollar (findings-v6 recommends this).

**Type B (hidden).**
- Severity-weighted recall (critical 4, high 3, medium 2, low 1): 40
- Precision: 25. A decoy hit costs 2, a speculative or false finding costs 1, a style nit costs 0.25. Findings past the 25-item cap are ignored.
- Severity calibration, within one tier of the manifest, plus precision of the top 5: 15
- Explanation, per matched plant: mechanism right, trigger right, fix direction right (0–2 each, normalised): 20

**Matching.** Grade in two stages, deterministic first.
- **Type A:** hidden tests decide "works", never the judge. Then an Opus judge gets the diff and that case's solution corpus. Each corpus entry has a short signature, such as "a single `INSERT … SELECT … WHERE count < capacity`" or "a module-level mutex". The judge picks the closest entry or says *novel*. Novel fixes go to Maxi for a label and join the corpus. Cheap AST signatures run before the judge: a `setTimeout` retry loop or a `Map` lock flags masks-symptom, and a new dependency flags over-engineering. They cut the judge's variance.
- **Type B:** a finding becomes a candidate for a plant when it names the plant's file and a line within ±8 of it (or the same function, or a second file the manifest lists). The judge then confirms the mechanism against the manifest's one-line cause. Each plant matches at most one finding, and duplicates merge. The judge sorts each unmatched finding into one of: decoy hit, real but unplanted ("native", checked by a human, then added to the manifest, no penalty), speculative, or nit.

**Fixture strategy.** Reuse the Meetups reference.
- **Type A:** it already passes 219 checks, so each A case is one clean, reversible plant: a branch of the reference with one hardening step undone. The rubric check that covers it becomes the hidden test.
- **Type B:** build one large app, "Meetups Hidden". Start from the reference, add five features to host plants (about 140 files), and keep a pool of 30 plants and 14 decoys. Each variant draws 18 plants and all the decoys from a seed, so a leaked manifest doesn't solve the next variant.
- **Other fixtures:** the email labeller for Worker, KV and Agent nooks. A small synthetic Nuxt 3 + NuxtHub v0.7 app for migrations.
- **Comments:** strip every comment that explains a hardening choice, in plants and clean code alike. The reference's comments name the bugs. Before planting, run three reviewers over the clean base, and fix or record any native bug they find.

---

## Type B fixture: Meetups Hidden

**Prompt given to the agent:** "Review this app for bugs that would hurt users or the business. Don't run it, install it or start it. Write `findings.json`: up to 25 items, most severe first, each with `{ file, line, severity: critical|high|medium|low, title, explanation }`." A `PRODUCT.md` states the intended rules: who may see attendee emails, that seat counts are public, and that password reset mail goes out at once. Then "by design" can be judged fairly. Web access is off, because the reference app is in the public Workspace.

**Features added to host plants** [G, design]:
- Comments on events, rendered from Markdown
- Co-organizers (a second role on an event)
- An emailed "Can't make it? Cancel" link
- A payment-provider webhook that marks paid RSVPs
- Attendee CSV exports stored in Blob

**Plant pool (30).** The ids are the case ids below. Severity is the manifest's.

| Sev | Plants |
| --- | --- |
| critical | S01 IDOR attendees, S02 ownership missing on write, S03 mass assignment `organizerId`, S04 secret in public config, S05 module-scope request state, S06 cached function leaks per-user fields, S10 Blob serve exposes exports, S16 emails in public API |
| high | S07 open redirect, S08 stored XSS `v-html`, S09 SVG/HTML upload, S11 GET-CSRF cancel, S12 CSRF check disabled, S13 `sql.raw` injection, S17 reset link from Host, S20 webhook unsigned, C01 oversell, C04 duplicate mail |
| medium | S14 XFF rate limit, S15 leaked errors, S18 CSV formula, C02 capacity race, C05 reminder dupes, C08 KV debounce, T01 server zone, P11 D1 100 params |
| low | P01 N+1, P02 JS pagination, P03 defeated index |

**Decoys (all in every variant).** Each looks wrong and is correct. They measure false positives.

| # | Code | Looks like | Why it is right | Source |
| --- | --- | --- | --- | --- |
| D1 | `db.update(events).set({ ...input })` with `input` from `readValidatedBody(event, eventInputSchema)` | mass assignment | `z.object` drops unknown keys by default, so `organizerId` can't get through | reference `index.patch.ts:12-18` [V]; Zod's default strip behaviour from Zod docs [G, not rechecked] |
| D2 | `navigateTo(String(route.query.redirect))` without `external` | open redirect | Nuxt 5 throws `NUXT_E2001` for `//x`, `/\x` and `/\tx`. It resolves the URL against two probe bases | nuxt-nightly `dist/app/composables/router.js:129-132`, `dist/app/utils.js:13-25` [V] |
| D3 | `` sql`… ${found.id} … ${Date.now()}` `` in Drizzle | SQL injection | template values are bound parameters | reference `rsvp.post.ts:18-27` [V] |
| D4 | JSON POST routes with no CSRF token | CSRF | Better Auth's cookie is `SameSite=Lax`, so a cross-site POST carries no session | better-auth 1.7.15 `dist/cookies/index.mjs:35` [V] |
| D5 | `routeRules: { "/": { swr: 60 } }` on a page whose header shows the user | cached personal HTML | Nitro v3 cache rules strip request cookies and remove `Set-Cookie` by default, so the cache holds the anonymous page. It is still a flash bug (H6), so it scores as low, never as a leak | ocache 0.3.1 `dist/index.d.mts:441-452`; nitro `dist/types/index.d.mts:2877-2878` [V] |
| D6 | `/api/events/[slug]/seats` without auth | missing auth | seat counts are public by product rule, and the response holds no personal data | reference `seats.get.ts` [V] |
| D7 | `findOwnedEvent` answers 404 to a stranger | wrong status | deliberate: it doesn't confirm that the event exists | `server/utils/events.ts:13-17` [V] |
| D8 | password reset mail sent inline, not queued | should use Queue | a queued job would keep the token on disk | `server/utils/mail.ts:71-80` [V] |
| D9 | CSV cell gets a `'` prefix | data corruption | defuses formula injection | `attendees.csv.get.ts:6-9` [V] |
| D10 | `requireRateLimit` after validation | ordering bug | deliberate: a form with mistakes doesn't use up the quota | `index.post.ts:11-13` [V] |
| D11 | `blob.del(found.coverPath)` right after a successful upload | data loss | the old object is orphaned once the swap succeeds | `cover.put.ts:30-40` [V] |
| D12 | `Cache-Control: immutable` on `/images` | stale covers | every upload gets a random-suffix path | `nuxt.config.ts` blob serve, `cover.put.ts:27` [V] |
| D13 | `started` computed from `Date.now()` in the API handler | hydration mismatch | the server decides it and the payload carries it, so both renders agree | `[slug]/index.get.ts:32-33` [V] |
| D14 | the Gmail push route verifies a Google JWT with `jose` and no shared secret | webhook not authenticated | the JWKS-verified token *is* the authentication | email-labeller `server/routes/gmail/push.post.ts` [V] |

**Vite Doctor coverage.** S04 (`nuxt/runtime/no-secret-in-public-config`), S05 (`nuxt/ssr/no-module-scope-request-state`), S08 (`vue` `restrictVHtml`) and T02 (`noRandomOrLocalTimeRender`, `nuxt/hydration/no-time-dependent-render-without-nuxttime-or-clientonly`) are rules in vite-doctor 0.1.2 [V: `node_modules/.pnpm/vite-doctor@0.1.2*/dist/rule-packs/{nuxt/rules/index.mjs,vue/rules.mjs}`]. They are the easy tier. Report recall with and without them, and decide whether the agent may run Doctor (open question 2).

---

## Cases

### S01 Attendee list and CSV readable by any signed-in user (IDOR)
- Type: both · Class: security · Primitive(s): Auth, Database
- Fixture: Meetups. In `attendees.get.ts:7` and `attendees.csv.get.ts:13`, replace `findOwnedEvent(slug, user.id)` with `findEventBySlug(slug)`. 2 lines.
- Report (A): "A guy who isn't the organizer of my event sent me my own attendee list as a joke. How??"
- Root cause: the route checks that someone is signed in, never that they organize this event.
- Why it gets written: `requireUser` makes the handler look guarded. The page is behind `middleware: auth`, so the author tests only as the organizer, through the UI. The two lookup helpers have similar names.
- Verification: a second user GETs both routes and must get 403 or 404. The organizer still gets 200. This is rubric A4.
- Solutions:
  - [best] use `findOwnedEvent` in both routes · one helper owns the rule
  - [acceptable] add an inline `organizerId !== user.id` check · correct, duplicated
  - [over-engineered] a role/permission framework, or `requireAuthorization()` with a custom policy for one rule · more surface than the bug
  - [masks-symptom] hide the link in the UI · the API stays open
  - [wrong] check in route middleware on `/dashboard/**` · server routes don't run app middleware
- Agent traps: fixes only the JSON route and misses the CSV. Answers 403 and so confirms which events exist (acceptable, but worth noting).
- Evidence: rubric A4 failed in 4/15 runs [R]. Drop `0b2c2d7d` "/api/members returns emails to admins only" [R]. Reference helper at `server/utils/events.ts:13-17` [V].
- Difficulty: 2 · Static-detectable: yes

### S02 Cover delete and event edit check the session, not the owner
- Type: both · Class: security · Primitive(s): Auth, Blob
- Fixture: Meetups. In `cover.delete.ts` and `index.patch.ts:11`, look the event up by slug only. The edit *page* still redirects non-owners. 2 lines.
- Report (A): "Someone changed the date of my meetup to last year. I didn't do it."
- Root cause: the server route trusts that only the edit page calls it.
- Why it gets written: the edit page loads through `findOwnedEvent` (through the GET), so the UI looks protected. Client middleware feels like authorization.
- Verification: user B PATCHes A's event and DELETEs its cover: expect 403/404, with the row and the blob unchanged.
- Solutions:
  - [best] `findOwnedEvent` in every write route · the owner check sits next to the write
  - [acceptable] put the owner condition in the UPDATE's WHERE and treat 0 rows as 404 · atomic, a little implicit
  - [over-engineered] a server middleware that parses `/api/events/:slug/*` and checks ownership · brittle path parsing
  - [wrong] a client-side check in `edit.vue`
- Agent traps: fixes PATCH and leaves cover PUT/DELETE open.
- Evidence: rubric A3 (2/15) and X10 [R]. The plant itself is synthetic.
- Difficulty: 2 · Static-detectable: yes

### S03 Mass assignment through `readBody` spread
- Type: both · Class: security · Primitive(s): Database, h3
- Fixture: Meetups, `index.patch.ts`: `const body = await readBody(event); db.update(events).set({ ...body, startsAt })`. Decoy D1 sits beside it in `index.post.ts`. 3 lines.
- Report (A): "An event I organized disappeared from my dashboard. Its page now says someone else hosts it."
- Root cause: the raw body, which can carry `organizerId`, `capacity` or `id`, is spread into the UPDATE.
- Why it gets written: `readBody` is the first h3 helper the docs show. Spreading feels the same as spreading `readValidatedBody`'s output, which is safe.
- Verification: a PATCH with `{"organizerId":"<other>"}` leaves the organizer unchanged, and a valid edit still works.
- Solutions:
  - [best] `readValidatedBody(event, eventInputSchema)`, the schema the form already uses (`shared/schemas/event.ts:15`) · one schema for both sides
  - [acceptable] pick fields by hand · correct, drifts from the schema
  - [over-engineered] a generic "allowed fields" DSL
  - [masks-symptom] `delete body.organizerId` · a denylist misses the next field
- Agent traps: flags D1 too (a false positive in B). Adds `.strict()` and breaks a client that sends extra fields (borderline).
- Evidence: rubric X8 (1/12) [R]; Charles's thread is cited in RUBRIC.md:414, "the validated body spread into a DB update" [V].
- Difficulty: 2 · Static-detectable: yes

### S04 Rates API key exposed to the browser
- Type: both · Class: security · Primitive(s): Env, runtimeConfig
- Fixture: Meetups. `nuxt.config.ts`: `runtimeConfig.public.ratesApiKey`, and `plugins/rates.ts` calls the provider from the browser. Variant: `import.meta.env.VITE_RATES_KEY`. 5 lines.
- Report (A): "Our exchange-rate bill went up 40× this month and we didn't get more traffic."
- Root cause: the key sits in public runtime config (or a `VITE_` variable) and ships in `__NUXT__` and the bundle.
- Why it gets written: the plugin runs on both sides, and a server-only key reads as empty in the browser. The quickest "fix" is `public`. Vite's `VITE_` prefix looks like a naming habit, not a publish switch.
- Verification: grep `.output/public` and the SSR HTML for the key value, and expect 0 hits. Rates still convert.
- Solutions:
  - [best] the server route with `defineCachedFunction`, key in server `runtimeConfig` or `env({ secret: true })` · the reference shape (`server/api/rates.get.ts`)
  - [acceptable] a server proxy without a cache · fixes the leak, keeps the cost
  - [masks-symptom] obfuscate or base64 the key
  - [wrong] rotate the key only
- Agent traps: rotates the key and stops there. Moves it to `.env` but leaves it under `public`.
- Evidence: rubric X1 (0/15, agents get this right greenfield) [R]. Doctor rule `nuxt/runtime/no-secret-in-public-config` [V]. `env` export at `packages/env/src/core/declarations.ts:257` [V].
- Difficulty: 1 · Static-detectable: yes

### S05 Signed-in user kept in module scope on the server
- Type: both · Class: security · Primitive(s): Auth, Nitro
- Fixture: Meetups. `server/utils/session.ts` gets `let current: User | null`, and a server middleware sets it per request. `dashboard.get.ts` reads `current`. The fixture's session store waits 15 ms, so requests interleave (findings-v4). 8 lines.
- Report (A): "Twice now my dashboard showed somebody else's events for a second. Then it was mine again."
- Root cause: process-wide state is shared across concurrent requests.
- Why it gets written: it works with one tester, and an in-memory store finishes in microtasks, so a shared value never shows another user (findings-v4.md:28 [V]).
- Verification: 50 parallel dashboard requests from 2 users, with every response matching its cookie.
- Solutions:
  - [best] read the session per request (`requireUser(event)`) · no shared state
  - [acceptable] `event.context.user` set by middleware · per request, but hides the dependency
  - [over-engineered] AsyncLocalStorage plumbing
  - [masks-symptom] clear `current` at the end of the request
- Agent traps: uses `useState` on the server side (that's Nuxt app state, not h3).
- Evidence: rubric A11 and S2 [R]. nuxt/nuxt#19623 "cross-request state pollution when useAsyncData is used in a plugin" [R]. Doctor `nuxt/ssr/no-module-scope-request-state` [V].
- Difficulty: 3 · Static-detectable: yes

### S06 "Speed up the event page" cache leaks per-user fields
- Type: both · Class: security · Primitive(s): Nitro cache
- Fixture: Meetups, `[slug]/index.get.ts`: the body wrapped in `defineCachedFunction(async (slug, userId) => …, { getKey: slug => slug, maxAge: 60 })`. The cached result includes `going` and `isOrganizer`. 6 lines.
- Report (A): "Sometimes I see an Edit button on events that aren't mine, and it says I'm going to events I never RSVP'd to."
- Root cause: the cache key covers the slug only, but the value depends on the user.
- Why it gets written: the cities cache (`cities.get.ts:7-12`) is the pattern to copy. Nitro v3's `defineCachedHandler` strips cookies, so an author who tried that saw "signed out for everyone" and moved to a cached *function*, which strips nothing.
- Verification: A loads the page, then B does: B's `isOrganizer` is false and `going` is B's own. A second request makes ≤1 DB round trip for the public part.
- Solutions:
  - [best] cache only the public part, keyed by slug, and add `going` and `isOrganizer` per request · the right split
  - [acceptable] no cache, with the three queries in parallel (as the reference does) · already fast
  - [acceptable] put `userId` in `getKey` · correct, but a cache entry per user per event
  - [wrong] `defineCachedHandler` with `varies: ["cookie"]` · per-cookie entries, and Set-Cookie is still stripped
  - [masks-symptom] shorten `maxAge` to 5 s
- Agent traps: removes the cache and keeps the leak in another helper. Doesn't notice that `seatsLeft` is now stale in the cache.
- Evidence: ocache `allowCookies`/`varies` semantics, `ocache@0.3.1/dist/index.d.mts:426-460` [V]. `defineCachedHandler` and `defineCachedFunction` are exported from `nitro/cache` (`nitro/dist/runtime/cache.d.mts:1-2`) [V]. The plant is synthetic.
- Difficulty: 3 · Static-detectable: yes

### S07 Open redirect after sign-in, through `external: true`
- Type: both · Class: security · Primitive(s): Nuxt router
- Fixture: Meetups. `sign-in.vue` does `navigateTo(route.query.redirect as string, { external: true })`, and `safeRedirect` is deleted. Variant: `window.location.href = redirect`. 2 lines.
- Report (A): "A user got a phishing mail with a real link to our sign-in page, and after logging in it took them to a fake site."
- Root cause: an untrusted `?redirect=` is followed as an absolute URL.
- Why it gets written: without `external`, Nuxt throws `NUXT_E2001`. Its own fix text says "Use `navigateTo('<url>', { external: true })`", so an agent that sees the error adds the flag.
- Verification: `?redirect=//evil.example`, `/\evil.example` and `https://evil.example` all land on `/`. `?redirect=/dashboard` still works.
- Solutions:
  - [best] a same-site path check (`app/utils/redirect.ts:5-7`) and plain `navigateTo` · two layers
  - [acceptable] plain `navigateTo` without `external`, catching `NUXT_E2001` and falling back to `/` · relies on Nuxt's check (D2)
  - [wrong] `redirect.startsWith("/")` · passes `//evil.example`
  - [wrong] an allow-list regex on the hostname that misses `/\`
- Agent traps: writes `startsWith("/")` and declares victory.
- Evidence: Nuxt diagnostic text, `nuxt-nightly dist/app/diagnostics/navigation.js:15-18` [V]. Rubric A6 (1/15) [R].
- Difficulty: 2 · Static-detectable: yes

### S08 Stored XSS: event description rendered through `v-html`
- Type: both · Class: security · Primitive(s): Vue
- Fixture: Meetups Hidden, the comments feature and the event description: `v-html="marked(event.description)"`. 2 lines plus a dependency.
- Report (A): "When I open one event, a popup asks for my password again."
- Root cause: organizer-written Markdown is rendered to HTML without sanitizing and injected into the page.
- Why it gets written: "support Markdown" plus `v-html` is the shortest path. `marked` doesn't sanitize by default [G, from marked's docs, not rechecked].
- Verification: a description with `<img src=x onerror=…>` doesn't execute (Playwright dialog count 0), and Markdown bold still renders.
- Solutions:
  - [best] Comark or a Markdown renderer to Vue nodes with no raw HTML · no HTML string at all
  - [acceptable] DOMPurify on the server before `v-html` · correct and common
  - [acceptable] `whitespace-pre-line` text, dropping Markdown · the reference's choice, loses a feature
  - [masks-symptom] a CSP alone · defense in depth, not the fix
  - [wrong] regex out `<script>`
- Agent traps: sanitizes in the browser only, which leaves the SSR HTML with the payload.
- Evidence: Console `f1c1de3` "secure session markdown rendering" (images from agent Markdown omitted) [R]. Drop `1892ddcc` Vue <3.5.42 SSR attribute-name XSS [R]. Doctor `restrictVHtml` [V]. Rubric X2 (0/15) [R].
- Difficulty: 2 · Static-detectable: yes

### S09 Upload trusts the declared type: SVG or HTML on the app origin
- Type: both · Class: security · Primitive(s): Blob
- Fixture: Meetups, `cover.put.ts:22-24`: `ensureBlob(file, { maxSize: "5MB", types: ["image"] })`, and the `detectContentType` check removed. 2 lines.
- Report (A): "Our security scanner says a cover photo on our site runs JavaScript."
- Root cause: `ensureBlob` checks `blob.type` as the browser declared it, and `"image"` accepts any `image/*`, `image/svg+xml` included. The serve route answers with the stored type.
- Why it gets written: `types: ["image"]` reads as "pictures only". Nothing in the name says "declared".
- Verification: upload an SVG with `<script>`, and a `text/html` body renamed `.png`: both get 400. JPEG, PNG and WebP still pass.
- Solutions:
  - [best] an explicit raster list plus `detectContentType()` on the bytes (reference `cover.put.ts:22-24`)
  - [acceptable] decode with sharp and re-encode · strong, costs CPU
  - [acceptable] serve with `Content-Disposition: attachment` and a sandbox CSP · contains the damage, the file is still stored
  - [wrong] check the file extension
- Agent traps: adds the byte check but keeps `"image"`, so SVG still passes the signature list if the list includes it.
- Evidence: `ensureBlob` short-type match, `packages/blob/src/ensure.ts:33-37` [V]. Serve uses the stored content type, `packages/blob/src/storage.ts:418-419` [V]. `detectContentType` at `packages/blob/src/content-type.ts:24` [V]. Rubric O6 and X9 [V].
- Difficulty: 3 · Static-detectable: yes

### S10 Blob's serve route publishes private CSV exports
- Type: both · Class: nook · Primitive(s): Blob
- Fixture: Meetups Hidden. A "Send me the CSV" job writes `exports/<eventId>.csv` to the default store, and `blob.serve` is on (`/images`) for covers. 4 lines.
- Report (A): "Someone posted our attendee list online. It has emails only the organizer should have."
- Root cause: the serve route serves the whole store, not a prefix, so `/images/exports/12.csv` is public and the id is guessable.
- Why it gets written: `serve: { route: "/images" }` reads like "serve images". `BlobServeOptions` has no prefix option, and the `authorize` hook sits in a separate `server/blob.ts`.
- Verification: GET `/images/exports/<id>.csv` signed out, and as a non-organizer: 401/403/404. The organizer's download still works.
- Solutions:
  - [best] a second Blob store for exports, not served, downloaded through an owner-checked route · separation by store
  - [acceptable] `serve.authorize: true` plus an `authorize` export that allows only `covers/` · works, the rule now sits in a hook
  - [acceptable] a signed short-lived URL (`blob.sign`) · provider-dependent
  - [masks-symptom] random names for the exports · unguessable, still public
  - [wrong] add `noindex`
- Agent traps: doesn't know `serve` covers the whole store and looks for a missing route instead.
- Evidence: `BlobServeOptions` (`authorize`, `anonymous`, `headers`, `publicBaseUrl`, `route`, `store`; no prefix), `packages/blob/src/types.ts:573-585` [V]. Default route `/api/_vitehub/blob`, `packages/blob/src/config.ts:42` [V]. The plant is synthetic.
- Difficulty: 4 · Static-detectable: yes (it takes knowing the primitive)

### S11 Cancel-RSVP link is a state-changing GET (CSRF)
- Type: both · Class: security · Primitive(s): h3, Email
- Fixture: Meetups Hidden. The reminder email links to `/api/events/<slug>/cancel` (a `.get.ts` that deletes the RSVP of the signed-in user). 10 lines.
- Report (A): "People say they got un-RSVP'd from events without clicking anything. They'd visited some forum."
- Root cause: a GET with side effects, and `SameSite=Lax` sends cookies on top-level GET navigation.
- Why it gets written: email links are GETs, and the comfort of D4 ("we have SameSite") hides that Lax protects only non-GET requests.
- Verification: a cross-site top-level navigation to the link leaves the RSVP in place. The link opens a confirm page that POSTs.
- Solutions:
  - [best] the GET shows a page, and a POST (same-site) cancels · standard
  - [acceptable] a signed one-time token in the link, no session · also works signed out
  - [over-engineered] a full CSRF-token middleware for every route
  - [wrong] check `Referer` only
- Agent traps: in B, flags D4 instead.
- Evidence: Better Auth cookie `sameSite: "lax"`, `better-auth/dist/cookies/index.mjs:35` [V]. joxi `1c973b6` finding 10 "same-origin cookie writes" middleware [R].
- Difficulty: 3 · Static-detectable: yes

### S12 Better Auth's CSRF and origin checks turned off to "fix" the proxy
- Type: both · Class: nook · Primitive(s): Auth
- Fixture: Meetups, `server/auth.ts`: `advanced: { disableCSRFCheck: true }`, and `baseURL` from the request origin only. 2 lines.
- Report (A): "Behind our nginx, sign-in said 'Invalid origin'. We fixed it, but our pentester flagged auth."
- Root cause: the origin mismatch came from HTTPS termination. Disabling the check lets any origin post to the auth endpoints.
- Why it gets written: the error names the check, and disabling it makes the symptom go away. The right fix, a public `baseURL` (`NUXT_PUBLIC_SITE_URL`), lives in a different file.
- Verification: a sign-in POST with `Origin: https://evil.example` is refused. Sign-in behind `X-Forwarded-Proto: https` with the configured site URL succeeds with a `Secure` cookie (rubric A2).
- Solutions:
  - [best] set `baseURL` from `NUXT_PUBLIC_SITE_URL` (reference `server/auth.ts:12-14`) · fixes the cause
  - [acceptable] `trustedOrigins` with the public origin
  - [wrong] `disableOriginCheck` · the same hole
  - [wrong] `trustedProxyHeaders: true` without a proxy that overwrites the headers
- Agent traps: keeps `disableCSRFCheck` and adds `trustedOrigins` on top.
- Evidence: options at `better-auth/dist/context/create-context.mjs:210-211` [V]. Origin check off under test (`isTest() ? true : false`, same lines) [V], so a test suite passes with the hole open. Drop `77ae1a8b` sign-in loop behind the auth proxy, with a CSRF cookie overwritten [R].
- Difficulty: 3 · Static-detectable: yes

### S13 Sort parameter injected through `sql.raw`
- Type: B · Class: security · Primitive(s): Database
- Fixture: Meetups Hidden, `events/index.get.ts`: ``.orderBy(sql.raw(`${sort} ${dir}`))`` from the query string. The LIKE search beside it is correct, which pairs it with decoy D3. 2 lines.
- Root cause: identifiers can't be bound, so `sql.raw` takes user text.
- Why it gets written: Drizzle's ``sql`${}` `` binds values, which teaches "Drizzle is safe". Sorting needs an identifier, and `sql.raw` is the only escape hatch.
- Verification: `?sort=starts_at;--` gives 400, or falls back to the default order. A unit test maps an allow-list.
- Solutions:
  - [best] a map from allowed sort names to columns
  - [acceptable] a zod enum, then a switch
  - [wrong] escape quotes in the string
- Agent traps: flags D3 as injection.
- Evidence: synthetic. Neighbour bug B12 (LIKE wildcards not escaped) in 6/15 runs [R].
- Difficulty: 2 · Static-detectable: yes

### S14 Rate limit keyed on a spoofable header
- Type: both · Class: security · Primitive(s): Rate-limit
- Fixture: Meetups. The RSVP and sign-up limit uses `requireRateLimit(event.req, "rsvp", { limit: 20, window: "1m", key: event.req.headers.get("x-forwarded-for") ?? "anon" })`. 1 line.
- Report (A): "A bot made 3,000 accounts last night. We have a rate limit!"
- Root cause: the client chooses the key. Without the header, everyone shares the `"anon"` bucket.
- Why it gets written: "rate limit per IP", and the IP "is" X-Forwarded-For in every blog post. ViteHub's own default key is the host's client address (or `cf-connecting-ip` on Cloudflare), so the hand-picked key makes things worse.
- Verification: a burst with rotating `X-Forwarded-For` still gets 429. Client B isn't blocked by client A (rubric A7).
- Solutions:
  - [best] drop `key` for anonymous routes (ViteHub picks the address) and use `user.id` for signed-in ones
  - [acceptable] read XFF only behind a configured trusted proxy (`trustProxy` flag)
  - [over-engineered] a Redis limiter
  - [wrong] key on `user-agent`
- Agent traps: adds a limit but keeps the shared `"anon"` fallback.
- Evidence: default key, `packages/rate-limit/src/guard.ts:77-80,120-122` [V]. Rubric A7 failed in 8/15 runs, e.g. `20261109-1632-meetups-v2-codex-a1`: "all clients share one bucket" [R].
- Difficulty: 2 · Static-detectable: yes

### S15 Database errors sent to the browser
- Type: B · Class: security · Primitive(s): h3, Database
- Fixture: Meetups Hidden. A `server/utils/handle.ts` wrapper does `catch (e) { throw createError({ status: 500, message: e.message, data: { sql: e.query, cause: e } }) }`. 5 lines.
- Root cause: `data` and `message` reach the client. libSQL errors carry SQL and sometimes the file path or URL.
- Why it gets written: it helps debugging, and h3 sends `data` back by design.
- Verification: force a constraint error. The response body holds no SQL, no path and no stack, and the server log has the cause.
- Solutions:
  - [best] log the cause and throw a plain 500 (or let Nitro mask it)
  - [acceptable] map known codes to 4xx with safe text
  - [wrong] strip `stack` only
- Agent traps: flags the reference's `console.error` with the provider's error code as a leak (it is a server log, not a response).
- Evidence: Doctor nitro `noHttpErrorMasking` exists [V]. The plant is synthetic.
- Difficulty: 2 · Static-detectable: yes

### S16 Attendee emails in the public event payload
- Type: both · Class: security · Primitive(s): Database
- Fixture: Meetups Hidden, `[slug]/index.get.ts`: it returns `attendees: await listAttendees(found.id)` for the "who's going" avatars, and `listAttendees` selects `email`. 2 lines.
- Report (A): "I'm getting spam addressed to me by name, mentioning a meetup I RSVP'd to."
- Root cause: an existing helper meant for organizers is reused for a public view. `__NUXT_DATA__` carries every field even if the template shows only names.
- Why it gets written: helper reuse, and the template hides the field, so the page "looks fine".
- Verification: signed out, the event HTML and the API JSON contain no `@` addresses. The avatars still render.
- Solutions:
  - [best] a public `listGoing()` that selects name only, or a count
  - [acceptable] map the result to names in the route
  - [masks-symptom] `pick` in the component
- Agent traps: removes the field from the template only.
- Evidence: Drop `0b2c2d7d` "On an open Drop every signed-in GitHub user saw everyone's address" [R]. Rubric A8 (1/15) and C5 [R].
- Difficulty: 2 · Static-detectable: yes

### S17 Password reset links built from the Host header
- Type: B · Class: security · Primitive(s): Auth, Email
- Fixture: Meetups, `server/auth.ts`: `baseURL: requestOrigin` with `trustedProxyHeaders: true`, and no `siteUrl`. 2 lines.
- Root cause: an attacker sends a reset request for the victim with `X-Forwarded-Host: evil.example`, and the mailed link points there, so the token leaks.
- Why it gets written: `requestOrigin` makes local dev work on any port. Trusting proxy headers "fixes" HTTPS detection.
- Verification: a reset request with a forged forwarded host. The captured outbox mail (ViteHub dev outbox) links to the configured site.
- Solutions:
  - [best] `baseURL` from `NUXT_PUBLIC_SITE_URL` in production · reference `auth.ts:12-14`
  - [acceptable] `trustedOrigins` plus rejecting unknown hosts in middleware
  - [wrong] strip the header in Nuxt middleware (Better Auth reads it first)
- Agent traps: misses it entirely. It needs reading Better Auth's URL code.
- Evidence: `getBaseURL` honours `x-forwarded-host` only when `trustedProxyHeaders`, `better-auth/dist/utils/url.mjs:68-76,135` [V]. joxi `9f1bd85` finding 14 "reminder links … first remembered origin, which later requests never replace" [R].
- Difficulty: 4 · Static-detectable: partly

### S18 CSV export runs formulas
- Type: B · Class: security · Primitive(s): —
- Fixture: Meetups, `attendees.csv.get.ts`: `rows.map(r => r.join(","))` with no quoting or defusing. 3 lines.
- Root cause: a name like `=HYPERLINK(...)` runs as a formula in Excel or Sheets.
- Why it gets written: CSV looks like plain text, and formula injection is folklore.
- Verification: a unit test on `=cmd`, `"a,b"` and `José` → quoted, `'`-prefixed, BOM.
- Solutions:
  - [best] quote every field and prefix `= + - @ \t \r` (reference `attendees.csv.get.ts:6-9`)
  - [acceptable] a CSV library with an escape option
  - [wrong] strip `=` characters
- Agent traps: flags decoy D9 in the clean variant.
- Evidence: rubric X3 [V]. The plant is synthetic.
- Difficulty: 1 · Static-detectable: yes

### S19 Co-organizer invite accepts any event id (IDOR on write)
- Type: B · Class: security · Primitive(s): Auth, Database
- Fixture: Meetups Hidden, `co-organizers.post.ts`: inserts `{ eventId: body.eventId, userId: body.userId }` after `requireUser`. The caller isn't checked against `eventId`. 3 lines.
- Root cause: the body chooses the resource, and authorization is only "signed in".
- Why it gets written: the id comes from a hidden form field the UI fills in, and the route reads like a join-table insert.
- Verification: user B adds themselves to A's event: expect 403/404.
- Solutions:
  - [best] take the event from the route param through `findOwnedEvent`
  - [acceptable] put the ownership check in the INSERT … SELECT
  - [wrong] check that `userId` equals the caller
- Agent traps: checks the invitee, not the inviter.
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: yes

### S20 Payment webhook unsigned, or compared with `===`
- Type: both · Class: security · Primitive(s): h3, Database
- Fixture: Meetups Hidden, `server/routes/webhooks/payments.post.ts`: marks an RSVP paid when `body.status === "paid"`. Variant: checks `header === secret`. 6 lines.
- Report (A): "We have more paid attendees than payments in the provider dashboard."
- Root cause: anyone can POST the webhook (or a timing leak exposes the secret). The handler also isn't idempotent when the same event is replayed.
- Why it gets written: the provider's quickstart parses JSON first, and the signature check needs the raw body, which h3 hands over only before `readBody`.
- Verification: an unsigned or wrongly signed POST gets 401. A replayed signed event changes nothing twice.
- Solutions:
  - [best] HMAC over the raw body (`await event.req.text()`), `crypto.timingSafeEqual`, and a unique provider event id
  - [acceptable] the provider SDK's verify helper
  - [wrong] an IP allow-list only
- Agent traps: verifies after `readBody`, which re-serializes the JSON, so the signature never matches, and then "fixes" that by skipping the check in dev.
- Evidence: ViteHub `67a98b13a9` "compare Gateway, Cron, and OAuth state secrets in constant time" [R]. Decoy D14 is the correct JWT form [V].
- Difficulty: 3 · Static-detectable: yes

### C01 Seats oversold when two people RSVP at once
- Type: both · Class: bug · Primitive(s): Database
- Fixture: Meetups, `rsvp.post.ts:18-27` → `const left = await seatsLeft(id); if (left <= 0) throw 409; await db.insert(rsvps)…`. The unique index stays. 8 lines.
- Report (A): "Seats left goes negative when two people RSVP at once. 14 people came to a 12-seat event."
- Root cause: check-then-insert across two statements. Two requests both read 1 seat left.
- Why it gets written: it is the obvious transcription of the rule. SQLite feels single-threaded, but the Node server interleaves awaits. Drizzle's `db.transaction` on libSQL looks like a fix and isn't (deferred transactions still read stale rows) [G].
- Verification: 30 parallel RSVPs from 30 users on a 12-seat event give exactly 12 rows and 18 409s, over 5 repeats (rubric P12).
- Solutions:
  - [best] one `INSERT … SELECT … WHERE count < capacity ON CONFLICT DO NOTHING RETURNING` · the reference
  - [acceptable] a `seats_taken` counter with `UPDATE … SET taken = taken + 1 WHERE taken < capacity RETURNING`, then the insert · two statements, still atomic per step, needs a compensating decrement
  - [acceptable] `BEGIN IMMEDIATE` transaction · correct on SQLite, not portable to D1
  - [over-engineered] a Queue that serializes RSVPs, or a KV lock
  - [masks-symptom] `max(capacity - count, 0)` in the display
  - [wrong] an in-process mutex (`Map<eventId, Promise>`) · breaks with two processes or Workers
- Agent traps: the mutex fix passes a single-process load test. Grade it with two server processes.
- Evidence: rubric B6 failed in 7/15 runs. `20261109-1448-meetups-v2-codex-a3`: "reads capacity first, then inserts … compensates with a delete using the stale capacity" [R].
- Difficulty: 3 · Static-detectable: yes

### C02 Lowering capacity below the people going
- Type: both · Class: bug · Primitive(s): Database
- Fixture: Meetups, `index.patch.ts:15-19` → a separate `count()`, then an unconditional update. 4 lines.
- Report (A): "I lowered my event to 10 seats and it still has 13 people. Now it says 0 left forever."
- Root cause: count-then-update races with RSVPs, and with no check at all, it lets the organizer go below the count.
- Why it gets written: the validation reads like form validation, not a concurrency rule.
- Verification: a PATCH to capacity 10 with 13 going gives 422. A parallel RSVP plus PATCH never ends with taken > capacity.
- Solutions:
  - [best] a conditional UPDATE with a `capacity >= (select count…)` predicate (reference `index.patch.ts:16-19`)
  - [acceptable] an immediate transaction
  - [masks-symptom] clamp the display
- Agent traps: fixes only the no-check case and leaves the race.
- Evidence: rubric B13 failed in 7/15 runs [R].
- Difficulty: 3 · Static-detectable: yes

### C04 Confirmation email sent twice on retry
- Type: both · Class: bug · Primitive(s): Queue, Email
- Fixture: Meetups, `server/utils/mail.ts:27-30`: the claim on `confirmationSentAt` is removed, and the job sends and then marks. The fixture's mail provider times out *after* accepting the message once. 4 lines.
- Report (A): "Some people get the 'You're going' email two or three times."
- Root cause: the queue retries a job whose send succeeded but looked failed. The handler isn't idempotent.
- Why it gets written: ViteHub Email's docs warn that "a blind retry can send a duplicate. Put retry and idempotency policy in Queue" (rubric N2 [V]). Authors read `idempotencyKey` as the whole answer, but it dedupes only *pending or running* jobs.
- Verification: inject a provider timeout after accept, and the outbox has exactly 1 mail per RSVP. A replayed `runQueue` after completion sends nothing.
- Solutions:
  - [best] claim the sent-at column in one conditional UPDATE before sending, and release it on a provider error (reference `mail.ts:25-68`)
  - [acceptable] the provider's idempotency key (Resend `Idempotency-Key`) plus a mark after the send [G]
  - [masks-symptom] `maxAttempts: 1` · no duplicates, lost mails
  - [wrong] only add `idempotencyKey` to `runQueue`
- Agent traps: the "wrong" option. It's what the API name suggests.
- Evidence: idempotency scope "A pending or running job with the same `idempotencyKey` returns its ID instead", `packages/queue/src/providers/local.ts:128-129` [V]. `runQueue` at `packages/queue/src/runtime/client.ts:161` [V].
- Difficulty: 3 · Static-detectable: partly

### C05 Reminder schedule sends twice or skips a day
- Type: both · Class: bug · Primitive(s): Schedule, Queue
- Fixture: Meetups, `schedules/event-reminders.ts`: selects events starting in `[now+24h, now+24h15m)` with no `reminderSentAt` filter and no idempotency key. 6 lines.
- Report (A): "After the server restarted, everybody got two reminders. Last week some people got none."
- Root cause: a time-window query has no memory. A missed or overlapping tick skips the window or covers it twice.
- Why it gets written: "every 15 minutes, events 24 h out" is how people describe cron jobs.
- Verification: run the tick twice at the same `scheduledAt` → 1 mail each. Skip a tick → the next tick still sends.
- Solutions:
  - [best] bound by `startsAt` within the next day, filter `reminderSentAt IS NULL`, and claim in the job (reference `event-reminders.ts:16-31`)
  - [acceptable] a window plus a KV record of handled ticks
  - [over-engineered] a Workflow per RSVP sleeping until T−24 h · works, heavy
  - [wrong] widen the window
- Agent traps: fixes the duplicates and keeps the gap.
- Evidence: rubric N4 [V]. `defineSchedule` at `packages/schedule/src/definition.ts:36-38` [V].
- Difficulty: 3 · Static-detectable: yes

### C06 Comment numbers collide (retry loop)
- Type: A · Class: bug · Primitive(s): Database
- Fixture: Meetups Hidden comments. `n = max(n) + 1` is read, then inserted, with 5 retries on a unique violation. 20 lines.
- Report (A): "When lots of people comment at once some get 'Could not allocate a comment number. Retry.'"
- Root cause: read-then-insert numbering, and the retry loop hides the race until load.
- Why it gets written: autoincrement per parent isn't built in, and retrying looks robust.
- Verification: 50 parallel comments on one event give numbers 1..50 with no gaps or duplicates, and 0 errors.
- Solutions:
  - [best] `n: sql\`(SELECT coalesce(max(n),0)+1 FROM comments WHERE event_id = ?)\`` in the INSERT, plus a unique (event_id, n) · Drop's fix
  - [acceptable] a per-event counter row with `UPDATE … RETURNING`
  - [masks-symptom] more retries with jitter
  - [wrong] number the comments in the client
- Agent traps: raises the retry count.
- Evidence: Drop `1892ddcc` "Comment numbers come from the insert itself instead of a 5-try retry loop" (`server/api/drops/[id]/comments.post.ts`) [R].
- Difficulty: 2 · Static-detectable: yes

### C07 Sync lock that only works in one isolate
- Type: A · Class: nook · Primitive(s): Database (D1), Schedule
- Fixture: email labeller at `2ddf40e^`: `let running: Promise | undefined` in `server/lib/sync.ts:180-205` guards sync. 25 lines (real code).
- Report (A): "Some emails get labelled twice and Gmail says we're over quota. It's only one cron!"
- Root cause: module state is per Worker isolate. Cron, push and manual syncs land on different isolates.
- Why it gets written: it works in dev and in Node. Nothing in Nitro says a Worker has many isolates.
- Verification: two parallel `sync()` calls against Miniflare D1 with separate module instances run one sync. The lease expires after a kill.
- Solutions:
  - [best] a D1 lease, a conditional `UPDATE … WHERE lease IS NULL OR lease < now RETURNING` · the real fix, `server/lib/sync-lease.ts`
  - [acceptable] a Durable Object or a Workflow singleton · correct, more infrastructure
  - [wrong] KV `setIfAbsent` · returns `KV_UNSUPPORTED_OPERATION` on Cloudflare KV
  - [wrong] keep the in-memory lock, adding a KV flag with get-then-set
- Agent traps: KV as a lock on Cloudflare.
- Evidence: email-labeller `2ddf40e` "a D1 lease on the mailbox lets one sync run at a time across Worker isolates" [R]. `setIfAbsent` is unsupported on Cloudflare, `packages/kv/src/types.ts:139-144` [V].
- Difficulty: 4 · Static-detectable: partly

### C08 Push debounce with KV get-then-set
- Type: both · Class: nook · Primitive(s): KV
- Fixture: email labeller, `server/routes/gmail/push.post.ts` as committed in `991e3a0`: `kv.get(lastSync)` → compare → `kv.set`. Real code, 6 lines.
- Report (A): "Bursts of label changes still start several syncs in the same second."
- Root cause: get-then-set isn't atomic, so concurrent pushes all read the old value.
- Why it gets written: it is how you'd write it with a Map. KV reads look like memory.
- Verification: 20 concurrent pushes start ≤1 sync per minute in a node-preset test with fs-lite KV.
- Solutions:
  - [best, Node/Upstash] `kv.setIfAbsent(key, now, { ttl: 60 })` · atomic, one call
  - [best, Cloudflare] a D1 conditional update (as in C07), because CF KV is eventually consistent
  - [acceptable] accept the race, since the existing lease (C07) already serializes the sync · the real app's choice: the debounce only trims load
  - [wrong] `kv.increment` and check `=== 1` without a TTL reset
- Agent traps: claims a "fix" that is still racy on CF KV. Doesn't notice that the lease already covers correctness, so the honest answer is "acceptable as is".
- Evidence: email-labeller `991e3a0` [R]. KV `setIfAbsent` and `increment` docs, `packages/kv/src/types.ts:133-144` [V].
- Difficulty: 3 · Static-detectable: yes

### P01 Event list makes one query per card for seats
- Type: A · Class: perf · Primitive(s): Database
- Fixture: Meetups, `events/index.get.ts`: items without the `taken` join, then `await Promise.all(items.map(i => seatsLeft(i.id)))`. 6 lines.
- Report (A): "The home page got slow since we have lots of events."
- Root cause: an N+1 count per card.
- Why it gets written: `seatsLeft()` exists, and reusing it per item is natural.
- Verification: a query counter (wrap the libSQL client) gives ≤2 queries for `/api/events`, and p50 drops.
- Solutions:
  - [best] a grouped subquery joined in one SELECT (reference `index.get.ts:27-49`)
  - [acceptable] one `GROUP BY event_id WHERE event_id IN (…)` query, merged in JS · watch D1's 100 parameters at page size >100
  - [over-engineered] a denormalized counter with triggers
  - [masks-symptom] `defineCachedFunction` around the list
- Agent traps: caches the list, which then shows stale seats.
- Evidence: rubric B10 (3/15) [R]. Drop `a4996961` "3 database round trips instead of 11" with `test/cost/round-trips.test.mjs` [R].
- Difficulty: 2 · Static-detectable: yes

### P02 Pagination done in JavaScript
- Type: A · Class: perf · Primitive(s): Database
- Fixture: Meetups, `index.get.ts`: `const all = await db.select().from(events)`, then filter, slice and `.length`. 2,000 → 50,000 seeded events. 6 lines.
- Report (A): "Search takes 4 seconds and the server's memory keeps growing."
- Root cause: loads every row (with descriptions) per request.
- Why it gets written: it's correct on 20 seed rows, and filters are easier in JS.
- Verification: response time under 150 ms at 50k rows, and the SQL has `LIMIT`/`OFFSET` (query log).
- Solutions:
  - [best] `where` plus `limit` and `offset` plus a parallel `count()` (reference)
  - [acceptable] keyset pagination · better for deep pages, changes the URL contract
  - [over-engineered] FTS5 for a 3-column LIKE
  - [masks-symptom] cache the full list
- Agent traps: adds `limit` but keeps the full count by loading all rows.
- Evidence: rubric B11 failed in 6/15 runs (`codex-a3`: "a fixed `.limit(60)` with no offset") [R].
- Difficulty: 2 · Static-detectable: yes

### P03 City filter defeats the index
- Type: both · Class: perf · Primitive(s): Database
- Fixture: Meetups, `index.get.ts`: ``sql`lower(${events.city}) = lower(${city})` ``. The `events_city_starts_at_idx` stays. 1 line.
- Report (A): "Filtering by city is way slower than the plain list."
- Root cause: a function on the column prevents the index lookup.
- Why it gets written: case-insensitive matching "for free".
- Verification: `EXPLAIN QUERY PLAN` uses `events_city_starts_at_idx`, and the filter returns the same rows for "berlin" and "Berlin".
- Solutions:
  - [best] normalise the city on write and compare equal (or a `COLLATE NOCASE` column plus index)
  - [acceptable] an expression index on `lower(city)` · SQLite supports it [G]
  - [masks-symptom] cache the filtered list
- Agent traps: adds a second index that the query still can't use.
- Evidence: rubric B8 failed in 7/15 runs, `20261109-1632-meetups-v2-codex-a1`: "`lower(city) = lower(?)` … can't use the events_city index" [R].
- Difficulty: 2 · Static-detectable: yes

### P04 Rates service makes every page wait
- Type: A · Class: perf · Primitive(s): Nitro cache
- Fixture: Meetups, `server/api/rates.get.ts`: a plain `fetch` with no cache or timeout. The fixture's rates server sleeps 4 s and counts hits. 8 lines.
- Report (A): "The event page takes 4 seconds. And the rates provider says we call them 10k times a day."
- Root cause: an uncached, untimed upstream call on every SSR.
- Why it gets written: it's a one-line fetch, and nobody tests with a slow upstream.
- Verification: 20 page loads → 1 upstream hit. A never-answering upstream on a cold cache → page under 3 s with euro prices (rubric C2).
- Solutions:
  - [best] `defineCachedFunction(…, { maxAge: 3600, swr: true })` plus `AbortSignal.timeout` plus a euro fallback (reference `rates.get.ts`)
  - [acceptable] a route rule `cache: { maxAge }` on `/api/rates` · no timeout unless added
  - [acceptable] a KV-stored value refreshed by a Schedule · decoupled, more moving parts
  - [masks-symptom] fetch the rates client-side after load
- Agent traps: caches without a timeout (the cold cache still hangs), or with a timeout and no fallback.
- Evidence: rubric C1 failed in 7/15 runs and C2 in 12/15 [R].
- Difficulty: 2 · Static-detectable: yes

### P05 Event page waits on sequential round trips
- Type: A · Class: perf · Primitive(s): Database, Auth
- Fixture: Meetups, `[slug]/index.get.ts`: organizer, seats, going and session each awaited in turn, with the fixture's DB at 40 ms per round trip (remote libSQL). 5 lines.
- Report (A): "The event page is slow only in production (Turso). Local is fine."
- Root cause: a waterfall of independent awaits multiplied by network latency.
- Why it gets written: `await` per line is the default style, and local SQLite hides the latency.
- Verification: a round-trip count (≤3 sequential) and p50 under a fixed 40 ms injected latency.
- Solutions:
  - [best] `Promise.all` over the independent reads (reference `index.get.ts:12-16`), or one joined query
  - [acceptable] fold organizer and seats into the event SELECT · fewer queries
  - [over-engineered] read replicas
  - [masks-symptom] a per-slug cache (and see S06)
- Agent traps: S06 itself.
- Evidence: Drop `a4996961` (11 → 3 round trips) [R]. Drop `57be0e1f` Smart Placement "round trips stop crossing regions" [R].
- Difficulty: 2 · Static-detectable: yes

### P06 Session read from the database on every request, assets included
- Type: A · Class: perf · Primitive(s): Auth, Blob
- Fixture: Meetups, `server/middleware/session.ts`: `event.context.user = (await auth.api.getSession({ headers }))?.user` for every request, `/images/**` included. Handlers also call `requireUser` again. 6 lines.
- Report (A): "Pages with lots of event photos load slowly and the database CPU is high."
- Root cause: one or two session lookups per request, multiplied by every image and API call.
- Why it gets written: "load the user in middleware" is the Express habit, and Nitro middleware runs for every route, the Blob serve route too.
- Verification: loading a page with 12 covers runs ≤2 session queries (DB log), and auth behaviour is unchanged.
- Solutions:
  - [best] drop the global middleware and read the session in the handlers that need it (reference `server/utils/session.ts`)
  - [acceptable] a middleware that returns early outside `/api` and memoizes on `event.context`
  - [acceptable] Better Auth `session.cookieCache` · fewer reads, staler revocation
  - [over-engineered] KV session cache
- Agent traps: cookieCache alone, which leaves the middleware running for images.
- Evidence: vite-hub/vitehub#4001 "Each guard on one request also read the session again … about 300 KiB per guard" (merged 2026-11-12) [R]. Better Auth `cookieCache` option at `better-auth/dist/cookies/index.mjs:50` [V].
- Difficulty: 3 · Static-detectable: yes

### P07 Vue session performance: Better Auth client in the entry chunk, and a duplicate get-session
- Type: A · Class: perf · Primitive(s): Auth (Vue client)
- Fixture: Meetups. `app/utils/auth-client.ts` imports `createAuthClient` from `better-auth/vue`, and a universal plugin runs `await authClient.getSession()` (no `callOnce`, no payload). `EventCard` calls `authClient.useSession()`. 8 lines.
- Report (A): "Every page feels slow to become clickable, even the public ones. The network tab shows get-session three times."
- Root cause: Better Auth's client sits in the entry chunk of every page. The session is fetched on the server and fetched again on hydration, plus once per subscribed component.
- Why it gets written: Better Auth's Vue quickstart creates the client at import. `useSession()` per component looks free.
- Verification: entry JS size (from `.output/public/_nuxt` stats) drops by the Better Auth client's size. A signed-in hard load makes 0 client get-session requests (rubric D2).
- Solutions:
  - [best] `createAuthClient` from `vite-hub/auth/vue`, which loads Better Auth on first use, plus the user in `useState` loaded once with `callOnce` on the server (reference `auth-client.ts`, `plugins/session.ts`, `useAuth.ts`)
  - [acceptable] keep Better Auth's client and move it to a lazy dynamic import · same effect, by hand
  - [acceptable] `useState` for the user, with Better Auth's client as is · fixes the requests, not the bundle
  - [over-engineered] a Pinia store for the session
- Agent traps: `<ClientOnly>` around the header, which causes a flash of the signed-out header (rubric H6).
- Evidence: this is my best match for Maxi's "Vue portal session performance" example [G on the match]. vite-hub/vitehub#2692 "createAuthClient loads Better Auth's Vue client on first use … ships Better Auth's client in the entry chunk of every page … In Drop that's every shared doc a visitor opens" [R]. Drop `f949cdb7` "pages load Better Auth's client only when someone signs in or out" [R]. `20261109-1632-meetups-v2-codex-a2` D2: "the browser makes two more GET /api/auth/get-session … universal plugin `await refresh()`" [R].
- Difficulty: 3 · Static-detectable: yes

### P08 Cached handler ignores the query: every page shows page 1
- Type: A · Class: nook · Primitive(s): Nitro v3 cache
- Fixture: Meetups, `events/index.get.ts` wrapped in `defineCachedHandler(handler, { maxAge: 30 })`. 2 lines.
- Report (A): "Since we added caching, search doesn't work and page 2 is the same as page 1."
- Root cause: Nitro v3's cached handlers (ocache) pass no query parameters to the handler or the key by default.
- Why it gets written: Nitro 2's `cachedEventHandler` keyed by the full URL, and old blog posts teach it.
- Verification: `?page=2` and `?q=rust` return different items with the cache on. Repeat calls are cache hits (`cacheStatusHeader`).
- Solutions:
  - [best] `allowQuery: ["q", "city", "page"]` · names the inputs
  - [acceptable] `allowQuery: true` · correct, so arbitrary queries create entries
  - [acceptable] drop the cache, since the query is indexed and fast
  - [wrong] `getKey` with the URL alone · "A custom `getKey` replaces key generation but does not disable URL filtering"
- Agent traps: the `getKey` route.
- Evidence: `allowQuery` docs, `ocache@0.3.1/dist/index.d.mts:434-441` [V]. nitrojs/nitro#5000 "Define global allowQuery / varies in nitro config" [R].
- Difficulty: 3 · Static-detectable: yes

### P09 A 30-day cache that never hits (setTimeout overflow)
- Type: A · Class: nook · Primitive(s): Nitro cache (memory driver)
- Fixture: Meetups. Event Markdown rendering is cached with `defineCachedFunction(…, { maxAge: 60*60*24*30 })` on the node preset without `vitehub.cache`. 2 lines.
- Report (A): "We cache the rendered descriptions for a month but the CPU profile shows we render every time."
- Root cause: the memory driver hands the TTL to `setTimeout`, and above 2^31−1 ms Node fires after 1 ms, so the entry is evicted at once.
- Why it gets written: long TTLs look harmless, and the warning (`TimeoutOverflowWarning`) hides in logs.
- Verification: a hit counter over 2 calls → 1 render. Look for `TimeoutOverflowWarning`.
- Solutions:
  - [best] `vitehub: { cache: true }`, which mounts fs storage on node (reference `nuxt.config.ts`), or a TTL under 24.8 days
  - [acceptable] patch unstorage (Drop's backport of unjs/unstorage#845)
  - [masks-symptom] precompute at build time
- Agent traps: doesn't look below Nitro.
- Evidence: Drop `1c72b513` "every render was evicted as soon as it was written. Backports unjs/unstorage#845" [R]. Whether the Nitro pinned here still ships the affected unstorage is [G]: check before building the case.
- Difficulty: 4 · Static-detectable: partly

### P10 Search fires a request per keystroke
- Type: A · Class: perf · Primitive(s): Nuxt data fetching
- Fixture: Meetups, `index.vue`: `v-model="q"` bound into `useFetch`'s reactive query. 2 lines.
- Report (A): "Typing in search makes the list flicker and our API logs show a request per letter."
- Root cause: a reactive query with no debounce, and no URL sync.
- Why it gets written: `useFetch` re-fetches on reactive change, which is the feature that makes it look easy.
- Verification: typing "berlin" gives ≤2 requests, and the URL holds `?q=berlin` (rubric D5).
- Solutions:
  - [best] a debounced write to the route query, with `useFetch` on the route (reference `index.vue`)
  - [acceptable] `refDebounced` (VueUse) feeding `useFetch`
  - [masks-symptom] fetch on submit only (a product change)
- Agent traps: debounces but leaves the URL stale.
- Evidence: rubric D5 failed in 5/15 runs, `20261109-1448-meetups-v2-codex-a3`: "6 requests … no debounce" [R].
- Difficulty: 1 · Static-detectable: yes

### P11 Dashboard 500s for big organizers (D1's 100 parameters)
- Type: both · Class: nook · Primitive(s): Database (D1)
- Fixture: Meetups on the cloudflare preset. The dashboard loads the organizer's events, then `inArray(rsvps.eventId, ids)` to count seats. The seed has one organizer with 150 events. 4 lines.
- Report (A): "Our biggest organizer gets an error page on the dashboard. Everyone else is fine."
- Root cause: D1 binds at most 100 parameters per statement.
- Why it gets written: SQLite locally allows 32,766 [G], so it passes every local test.
- Verification: the dashboard with 150 events answers 200 on Miniflare D1 and matches the counts.
- Solutions:
  - [best] one grouped LEFT JOIN, no id list (reference `dashboard.get.ts`)
  - [acceptable] chunk the ids by 100 · works, more round trips
  - [wrong] raise a limit (not configurable)
- Agent traps: chunks by 1,000.
- Evidence: Drop `1892ddcc` "D1 binds at most 100 parameters: /api/members … no longer pass it" [R]. drizzle-team/drizzle-orm#2479 "D1 too many SQL variables" [R].
- Difficulty: 3 · Static-detectable: partly (only if the preset is known)

### T01 Venue time read in the server's time zone
- Type: both · Class: bug · Primitive(s): —
- Fixture: Meetups, `index.post.ts`: `startsAt: new Date(startsAtLocal)`, and `zonedLocalToInstant` is removed. The server runs in UTC, the venue in Madrid. 1 line.
- Report (A): "Events created from Spain show up an hour or two early for everyone."
- Root cause: a `datetime-local` string parses in the server's zone, not the venue's.
- Why it gets written: `new Date("2026-12-01T18:30")` works on the developer's laptop in the same zone.
- Verification: TZ=UTC server, `18:30 Europe/Madrid` on a winter and a summer date → `17:30Z` and `16:30Z`. A nonexistent spring-forward time is refused (rubric T1).
- Solutions:
  - [best] convert with the event's IANA zone (reference `shared/utils/time.ts:24-34`) or `Temporal.ZonedDateTime`
  - [acceptable] send the browser's UTC instant, which only works when the browser is in the venue's zone
  - [wrong] add a fixed offset
- Agent traps: the "acceptable" option, which breaks for an organizer travelling.
- Evidence: rubric T1 failed in 7/15 runs, `codex-a3`: "`new Date(String(body.startsAt))` in the server's zone" [R].
- Difficulty: 3 · Static-detectable: yes

### T02 `Date.now()` decides first paint (hydration mismatch)
- Type: A · Class: bug · Primitive(s): Nuxt SSR
- Fixture: Meetups, `EventCard.vue`: `const started = computed(() => new Date(startsAt) <= Date.now())` switches the RSVP button. Also `new Date().getFullYear()` in the footer. 2 lines.
- Report (A): "The console has hydration warnings and sometimes the RSVP button flips from 'Started' to 'RSVP'."
- Root cause: the server and the client compute time-dependent output at different instants and in different zones.
- Why it gets written: it is the plain Vue way, and the warning shows only near a boundary.
- Verification: Playwright with a browser zone different from the server's, and a clock pinned to 1 s before start: 0 hydration warnings (rubric H2).
- Solutions:
  - [best] the server decides `started` and the payload carries it (reference `[slug]/index.get.ts:33`), plus `<NuxtTime>` for display
  - [acceptable] `useState("now", () => Date.now())`, carried in the payload
  - [masks-symptom] `<ClientOnly>` around the button
- Agent traps: ClientOnly everywhere, which shifts the layout.
- Evidence: rubric H5 failed in 12/15 runs (e.g. `20261109-2002-meetups-v2-claude-code-a3`) [R]. Doctor `noRandomOrLocalTimeRender` [V].
- Difficulty: 2 · Static-detectable: yes

### M01 NuxtHub v0.7 app → ViteHub
- Type: A · Class: migration · Primitive(s): Database, Blob, KV
- Fixture: a new small app, Nuxt 3, `@nuxthub/core` 0.7: `hubDatabase().prepare().bind().all()`, `hubBlob().serve(event, path)`, `hubKV().get()`, `useDrizzle()`, `.data/hub`. About 25 files.
- Report (A): "Move this 3-year-old NuxtHub app to ViteHub and Nuxt 5. Keep the data."
- Root cause: (migration) the APIs moved, and ViteHub methods return `[error, value]`.
- Why it gets written: same method names, different return shape, so `if (await kv.get(k))` is always truthy (a tuple), and `return blob.serve(event, p)` returns a tuple.
- Verification: hidden HTTP tests pass on Nuxt 5. Local data moved from `.data/` to `.vitehub/data/`. A grep finds 0 unchecked tuple uses (AST probe: a call result used directly in a condition or return).
- Solutions:
  - [best] follow `migrate-from-nuxthub.md`: the module swap, the `hub` → `vitehub` key, a preset, tuple destructuring with errors handled, the schema moved to `server/databases/`
  - [acceptable] wrap the tuples in a throwing helper · works, hides the errors-as-values design
  - [over-engineered] an adapter layer that keeps the NuxtHub API
  - [wrong] keep raw D1 `prepare()` calls through a binding
- Agent traps: misses the tuple shape where TypeScript doesn't complain (truthiness checks).
- Evidence: the migration guide, `docs/content/docs/getting-started/migrate-from-nuxthub.md:21-30,87-130` [V]. nuxt-hub/core#847 (`blob.serve()` ignores the fs driver) [R].
- Difficulty: 4 · Static-detectable: no

### M02 h3 v1 handlers → h3 v2 and `nuxt/server`
- Type: A · Class: migration · Primitive(s): h3
- Fixture: Meetups' server routes rewritten in Nuxt 3 style: `event.node.req`, `setResponseHeader`, `sendRedirect(event, url)`, `getCookie`, `readBody` without a schema. About 15 files.
- Report (A): "Upgrade to Nuxt 5. The build fails with MISSING_EXPORT."
- Root cause: (migration) `nuxt/server` is a portable subset of h3. Some v1 helpers are gone, and Node objects aren't there on every preset.
- Why it gets written: every Nuxt 3 tutorial shows these names.
- Verification: `nuxt build` passes on node and cloudflare presets, and the hidden HTTP tests pass (headers, redirects, cookies).
- Solutions:
  - [best] `event.res.headers.set`, `event.req.headers`, return a `Response`, and `readValidatedBody` · Web-standard
  - [acceptable] import the helpers from `h3` directly · works on node, may not be portable
  - [wrong] `event.node.res.setHeader` behind `import.meta.server`
- Agent traps: imports from `h3` everywhere and loses the portability claim.
- Evidence: findings-v4.md:27, "`setResponseHeader` from `nuxt/server` fails the build (`MISSING_EXPORT`)" [V]. findings-v3.md:34, the dotted-suffix route name trap [V].
- Difficulty: 3 · Static-detectable: partly

### M03 `setInterval` cron and `waitUntil` mail → Schedule and Queue
- Type: A · Class: migration · Primitive(s): Schedule, Queue, Email
- Fixture: Meetups: a Nitro plugin with `setInterval(sendReminders, 15*60e3)`, and RSVP mail sent with `event.waitUntil(email.send(...))`. 30 lines.
- Report (A): "Reminders stop when we deploy, and confirmations sometimes never arrive. Use ViteHub for this."
- Root cause: process timers die on restart and run in every process. A fire-and-forget send loses mail on a provider error.
- Why it gets written: it was the only option before the primitives existed.
- Verification: `vitehub schedule run event-reminders` queues jobs. A provider error retries. 2 processes → 1 reminder per RSVP. `pnpm build` on node with `schedule: { runtime: { driver: "process" } }`.
- Solutions:
  - [best] `defineSchedule` → `runQueue` per RSVP → `defineQueue` with the claim (the reference shape)
  - [acceptable] a Schedule that sends inline in bounded batches · no per-mail retry
  - [over-engineered] a Workflow per RSVP
  - [wrong] `schedule: true` on node · fails the build with `VITE_HUB_R0137`
- Agent traps: the R0137 build error. Keeps `waitUntil` "for speed".
- Evidence: findings-v5.md:32 (R0137) [V]. Rubric N1, "`event.waitUntil` … loses the email on a provider error or a restart" [V]. `defineQueue` at `packages/queue/src/definition.ts:4` [V].
- Difficulty: 3 · Static-detectable: partly

### M04 Port the Meetups reference from node to Cloudflare
- Type: A · Class: migration · Primitive(s): Database (D1), Queue, KV, Schedule, Rate-limit, Blob
- Fixture: the unmodified Meetups reference.
- Report (A): "Deploy this on Cloudflare Workers instead of our VPS."
- Root cause: (migration) four hidden incompatibilities:
  - `idempotencyKey` is refused by Cloudflare Queues (see N01)
  - `setIfAbsent` is unsupported on CF KV
  - D1's 100-parameter limit
  - the schedule driver
- Why it gets written: the preset swap compiles, and the failures show only at runtime as logged errors.
- Verification: a Miniflare run of the hidden suite. RSVP produces a confirmation in the outbox. The reminders cron triggers.
- Solutions:
  - [best] `preset: "cloudflare"`, the D1 binding, and `idempotencyKey` removed, relying on the handler's claim (already idempotent)
  - [acceptable] the same with a D1-backed dedup table · redundant
  - [wrong] keep `idempotencyKey`, since the error is only logged (reference `rsvp.post.ts:33-34`)
- Agent traps: never looks at the `[error]` the route logs.
- Evidence: `cloudflareUnsupportedEnqueueOptions = ["idempotencyKey", "region", "retentionSeconds"]`, `packages/queue/src/errors.ts:10`, returned as `QUEUE_UNSUPPORTED_OPTION`, `packages/queue/src/providers/cloudflare.ts:61-66` [V].
- Difficulty: 4 · Static-detectable: partly

### N01 No confirmation emails since we moved to Cloudflare
- Type: both · Class: nook · Primitive(s): Queue
- Fixture: Meetups on the cloudflare preset, as is. 0 lines planted: the reference's `runQueue(…, { idempotencyKey })` is the bug on this host.
- Report (A): "Since moving to Workers nobody gets the 'you're going' email. No errors for users."
- Root cause: Cloudflare Queues don't support `idempotencyKey`. `runQueue` returns `QUEUE_UNSUPPORTED_OPTION`, and the route only logs it.
- Why it gets written: the option is portable on node and Vercel. Errors-as-values make a failure silent unless someone reads `[error]`.
- Verification: on Miniflare, RSVP → one job → one outbox mail. A duplicate RSVP still sends once (the handler's claim).
- Solutions:
  - [best] omit `idempotencyKey` on Cloudflare and rely on the handler's claim (`mail.ts:27-30`), which is already idempotent
  - [acceptable] choose options by preset · more code
  - [masks-symptom] send the mail inline when the queue errors
  - [wrong] retry `runQueue` with the same options
- Agent traps: blames Resend or the queue consumer config.
- Evidence: as in M04 [V]. This is a real latent bug in the reference if deployed to Cloudflare. It is a native finding for Type B on a CF-preset variant.
- Difficulty: 4 · Static-detectable: yes (with knowledge of the primitive)

### N02 Agent hook in a child layer silently replaces the preset's
- Type: A · Class: nook · Primitive(s): Agent
- Fixture: email labeller at `b2b6f33^`, `server/lib/replay.ts`: `defineAgent({ …, hooks: { "agent:finish": collect } })` extends the labeller preset. Real code.
- Report (A): "Backfill reports the right labels but never applies them to the emails."
- Root cause: ViteHub merges Agent hooks as `{ ...parent, ...child }`, so the child's `agent:finish` replaces the preset's, which applies the labels.
- Why it gets written: hooks usually compose (Nuxt and Nitro hooks chain), so nothing hints at replacement.
- Verification: the backfill test asserts that `message.modify` is called with the decided label.
- Solutions:
  - [best] call the parent hook from the child (`labeller.hooks?.["agent:finish"]`) · the real fix
  - [acceptable] collect decisions through a different hook name
  - [wrong] re-implement label application in replay
- Agent traps: duplicates the preset's logic.
- Evidence: email-labeller `b2b6f33` "ViteHub merges hooks as { ...parent, ...child }, so it replaced the preset hook" [R]. I didn't check the merge code in ViteHub [G].
- Difficulty: 4 · Static-detectable: partly

### N03 Header always shows "Sign in" in the server HTML
- Type: A · Class: nook · Primitive(s): Auth (Vue)
- Fixture: Meetups. The header uses `useUserSession()` from `vite-hub/auth/vue` directly, and `plugins/session.ts` and `useAuth` are removed. 10 lines.
- Report (A): "When I'm logged in, the page flashes 'Sign in' for a moment before showing my name."
- Root cause: the client store stays pending during SSR, so the user never reaches the payload.
- Why it gets written: `useUserSession` is the ViteHub Auth composable that the docs name, and it looks universal.
- Verification: curl with a session cookie: the SSR HTML holds the user's name (rubric H1/H6). 0 client get-session calls on load.
- Solutions:
  - [best] load the session once on the server into `useState` (`callOnce` in a plugin, `useRequestFetch`) · reference `plugins/session.ts`, `useAuth.ts`
  - [acceptable] middleware that fills `useState` from a server-only helper
  - [masks-symptom] `<ClientOnly>` with a skeleton
- Agent traps: the masks-symptom option.
- Evidence: rubric S1 failed in 4/15 runs, `20261109-2001-meetups-v2-codex-a1`: "`useUserSession()` … returns a pending, empty state on the server (`if (!("window" in globalThis)) return state`)" [R]. vite-hub/vitehub#2692: hooks "stay pending" during SSR [R].
- Difficulty: 3 · Static-detectable: yes

---

## The 20 to build first

The first ten all live on the Meetups reference, cost one small plant each, and reuse rubric checks as hidden tests:

| # | Case | Type | Why it's first |
| --- | --- | --- | --- |
| 1 | C01 | A | Maxi's own example, and real in 7/15 runs |
| 2 | S01 | both | The plainest authz plant; Type B can't work without it |
| 3 | S06 | both | A perf report that tempts the agent into a leak; tests judgment |
| 4 | P07 | A | Likely Maxi's "Vue session" case |
| 5 | P04 | A | A real 12/15 fail, cheap to verify by counting hits |
| 6 | T01 | both | Real in 7/15 runs, deterministic test |
| 7 | C04 | both | The `idempotencyKey` misconception, a ViteHub-specific trap |
| 8 | S09 | both | A Blob nook; `ensureBlob` semantics are verified |
| 9 | S10 | both | A Blob serve nook nobody would guess |
| 10 | P08 | A | Nitro v3 cache defaults trip anyone who knows Nitro 2 |

The next ten give class coverage. Each brings in a second fixture or a real commit:

| # | Case | Type | Why |
| --- | --- | --- | --- |
| 11 | C07 | A | Real email-labeller commit, Worker isolates |
| 12 | C08 | both | Real code whose honest answer is "acceptable as is"; tests over-fixing |
| 13 | N01 | both | A latent bug in our own reference |
| 14 | P01 | A | N+1, with a query-count test |
| 15 | S07 | both | `external: true` is what Nuxt's own error message suggests |
| 16 | S12 | both | Real proxy pain (Drop `77ae1a8b`) |
| 17 | S14 | both | Real in 8/15 runs |
| 18 | P06 | A | Session perf, mirrors vitehub#4001 |
| 19 | M01 | A | The migration class; uses ViteHub's own guide |
| 20 | C06 | A | Real Drop commit; the masks-symptom answer is tempting |

For Type B, the first "Meetups Hidden" variant uses the plants S01–S05, S07–S10, S13, S14, S16, S18, C01, C04, C05, T01 and P03 (18 in all), plus all 14 decoys.

## Open questions for Maxi

1. **Web access for Type B.** The reference is visible in the public Workspace (`main`) and possibly on GitHub. Should Type B runs have no web, or should we reshape the fixture (rename tables, rewrite the UI) enough that a diff against the reference doesn't help?
2. **Vite Doctor in Type B.** May the agent run Vite Doctor or another linter? It is static, and it would find S04, S05, S08 and T02 for free. I'd allow it and report recall without the Doctor-visible plants as the headline.
3. **Precision rule.** Should "real but unplanted" findings earn credit (a bonus) or only avoid a penalty? A bonus rewards thoroughness but makes scores depend on how complete our manifest is.
4. **Product spec.** May Type B ship a `PRODUCT.md` with the intended access rules? Without one, D6, D7 and S16 are opinions, not bugs.
5. **Comments in fixtures.** Strip all explanatory comments from the reference (my recommendation), or keep them and plant misleading ones too? Misleading comments are a real-world trap, but they test reading, not reasoning.
6. **Host variants.** Type A on node only, or a Cloudflare (Miniflare) variant for the nook cases (N01, M04, P11, C07, C08)? Miniflare in the verifier adds about 1 GB and some minutes per run [G].
7. **Masks-symptom fixes.** Does a masks-symptom fix that passes the hidden tests still count as "works"? I score it 0.1 on solution class, but an agent could pass the gate with a clamp (C01: `max(…, 0)`). The hidden test must check the invariant (rows ≤ capacity), not the display.
8. **"Vue portal".** Is P07 (vitehub#2692 plus the duplicate get-session) the case you meant? If you meant a `<Teleport>` component, I found nothing matching "portal" in ViteHub's or the apps' history.
