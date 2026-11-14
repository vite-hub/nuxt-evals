# Council seat 4 (Claude Fable): eval design, measurable performance cases, and change tasks

Lens: the generalist and designer. 35 cases. Most of my effort went into three things the other seats cover less: how to measure a fix fairly, performance cases whose check is a count or a byte total, and tasks that are neither greenfield nor bug fix.

Source tags. **[V]** I read it at that path and line. **[R]** a real commit, PR or issue. **[S]** a plant I designed, not found in history. **[G]** a guess, not checked. ViteHub paths are at `1e807fc`, the commit the Meetups reference pins, read with `git show` and `git grep`. The local ViteHub checkout is older (HEAD `451425205f`, 2026-10-11) and `origin/main` is `a6a5653dbd` (2026-11-14). Where main differs from the pin I say so.

I wrote my case list before reading `council-grok.md` and `council-sol.md`, then dropped or narrowed the cases they already hold. Where a neighbour exists I name it.

## Scoring, matching, fixtures

**A (fix).** A gate comes first, reported as its own rate: the hidden fail-to-pass tests pass, the pass-to-pass suite stays green, the app builds. Runs past the gate get a quality score from 0 to 10.

| Dimension | Weight | How |
| --- | --- | --- |
| Solution class | 30 | best 1, acceptable 0.75, over-engineered 0.4, masks-symptom 0.1, wrong 0 |
| Root cause | 20 | 10 if the diff changes the planted lines, with no model. 10 if the final message names the cause. |
| Footprint | 15 | lines, files, new dependencies, tables and ViteHub packages against the best fix: full marks to 1.5 times, zero at 6 times |
| Right API | 15 | the API the best fix uses, not a hand-rolled copy |
| No collateral | 10 | Vite Doctor delta, typecheck, edits away from the cause |
| Own verification | 10 | reproduced the report first, or left a test that fails on the plant |

Time, tokens and cost stay beside quality, plus cost per accepted fix: total cost divided by the runs that pass the gate as best or acceptable.

**B (hidden).** Severity-weighted recall 40, precision 30, explanation 20, severity order 10. Run each agent on the clean base too: what it reports there is its false-positive floor.

**Matching.** Three steps, cheapest first.
1. Hidden tests: a reproduction test, plus a discriminator that a tempting wrong fix fails. A cached list passes the timing test and fails "seats are fresh after an RSVP".
2. Fingerprints, with no model: the SQL the fix emits, counts of queries, jobs and upstream calls, new dependencies, AST marks such as a `setTimeout` retry.
3. An Opus judge reads the diff and the ranked corpus and picks one entry or "novel". Novel goes to Maxi for a rank and joins the corpus.

**Fixtures.** Three.
- The Meetups reference, comments stripped, seeded to 20,000 events and 200,000 RSVPs. One plant per case, as a patch.
- Drop at the parent of a real fix commit: 50,600 lines, and the fix's own tests become the hidden tests. The large app already exists.
- A small Nuxt 3 and NuxtHub app for migrations.

Not one huge synthetic app for A. One plant per run keeps the score attributable, and the same plant in Meetups and in Drop shows what app size costs.

## Why these bugs get written

Each case names one or two of these causes in its "Why it gets written" line.

| Code | Cause | What makes it easy to write |
| --- | --- | --- |
| W1 | Local hides remote | Local SQLite answers in under 1 ms from one process. Production is D1 or Turso at about 55 ms per round trip [R Drop `test/cost/round-trips.test.mjs` comment], on many isolates. N+1, serial awaits and in-memory locks cost nothing in dev. |
| W2 | Two runtimes, one file | A Vue file runs on the server and in the browser. Module scope on the server is shared by every request. Clock, time zone and locale differ between the two renders. |
| W3 | Errors as values | ViteHub helpers return `[error, value]` and do not throw [V main `docs/content/docs/reference/doctor-rules.md` VHUB0003]. Code written like every other library loses the failure. |
| W4 | Check, await, act | Every `await` lets another request in. Read, decide, write without one atomic statement or a constraint. |
| W5 | At-least-once delivery | Queue jobs, Schedule ticks, Workflow steps and webhooks run again after a failure. A handler that is not safe to repeat duplicates its side effect. |
| W6 | Dev defaults differ from production | Mail stays in the dev outbox, the rate limiter is in memory, Blob is on disk, the dev server runs Schedules itself. Code that works in `nuxt dev` proves little about the built server. |
| W7 | The short form over-fetches | `db.select()` with no columns, `useFetch` copying the whole response into the payload, a global plugin or middleware that runs on every route, a static import in the layout. |
| W8 | API drift | Nuxt 3 to 5, h3 v1 to v2, NuxtHub to ViteHub, and ViteHub's own renames. Models write the API they remember. |
| W9 | Authorization is per file | File-based routes have no default deny. Each new route file must repeat the guard. |
| W10 | Cache as a speed patch | A cache added to fix a slow page takes whatever the function closed over: one user's data, one query's result, stale seats. |
| W11 | The schema lives in three places | The Drizzle schema, the migration files and the production database. They drift when someone edits one alone. Auth tables add a fourth owner. |
| W12 | Host limits | D1 binds at most 100 parameters and refuses LIKE patterns over 50 bytes [R Drop `1892ddcc`, `db185059`]. `setTimeout` overflows above 2^31 ms [R Drop `1c72b513`]. None of it shows on Node with SQLite. |

## Cases

Type C is my proposal for lens item 4: a change task on an existing app with no planted bug. The shape stays the same. "Root cause" becomes "What makes it hard".

### Performance with a hard check

### P-01 The list page ships every column
- Type: both · Class: perf · Primitive(s): Database, Nuxt payload
- Fixture: Meetups, `server/api/events/index.get.ts`. The projected `select({...})` becomes `select()` and the handler returns the rows. Seed descriptions at 4 KB. 8 lines.
- Report given to the agent (A only): "home page feels heavy on my phone. view source is enormous"
- Root cause: the list endpoint returns every column of 24 events, description and organizer id included, and `useFetch` copies the response into the HTML payload.
- Why it gets written: W7. `db.select()` with no argument is the shortest Drizzle query, and nothing in dev shows payload size.
- Verification: on the production build, the `__NUXT_DATA__` script of `GET /` is at most 12 KB (planted about 110 KB [G]). The `GET /api/events` body is at most 10 KB. Neither contains a `description` or `organizerId` key. The page still shows title, city, date and seats left.
- Solutions:
  - [best] project the columns in SQL, as reference `index.get.ts:31-41` [V] · fixes the database read, the API and the payload at once
  - [acceptable] map rows to a smaller object in the handler · API and payload fixed, the database still reads the text
  - [masks-symptom] `pick` or `transform` on `useFetch` · the payload shrinks, the API still sends and exposes every column, so the API-bytes check fails
  - [over-engineered] a second `/api/events/cards` endpoint plus a store
  - [wrong] `server: false` or `lazy` on the fetch · the payload is small because the list left the HTML
- Agent traps: `transform` only. Truncating the description in CSS.
- Evidence: plant [S]. Plan v2 feature F1 asks for this budget [V `research/plan-v2.md:116`]. Neighbour: SOL-07.
- Difficulty: 2 · Static-detectable: yes

### P-02 The chart library loads on every page
- Type: A · Class: perf · Primitive(s): Nuxt code splitting
- Fixture: Meetups variant whose dashboard chart uses a chart package. The reference draws its chart with no library [V `app/components/RsvpChart.vue` has no imports], so the variant adds one, as the first Meetups fixture did [V `research/plan-v2.md:110`]. Plant: `app/plugins/charts.ts` registers the chart components globally. 10 lines.
- Report given to the agent (A only): "lighthouse says the home page downloads 400 KB of javascript it never uses"
- Root cause: a global plugin imports the chart package, so it lands in the entry chunk of every route.
- Why it gets written: W7. Registering components globally in a plugin is the documented way for many Vue libraries.
- Verification: build, then read the client manifest. The entry chunk plus the static imports of `/` hold no module of the chart package, and their total JS bytes are within 5% of the base without the package. Playwright on `/` requests no chunk that contains it. The dashboard still draws the chart.
- Solutions:
  - [best] delete the plugin and import the chart in the dashboard component · the route split does the rest
  - [acceptable] a `Lazy` component or `defineAsyncComponent` on the dashboard
  - [acceptable] dynamic `import()` when the chart mounts
  - [over-engineered] replace the package with a hand-drawn SVG chart
  - [masks-symptom] `<ClientOnly>` around the chart · still in the entry chunk
  - [wrong] a `manualChunks` rule · moves the bytes to another file the page still preloads
- Agent traps: checks the dashboard still works and never measures `/`.
- Evidence: Drop `6b331bbd` "a shared doc opens without downloading the live editor ... cuts the page's up-front JS by about a third" [R]. Plan v2 F8 "The chart JS is not in the `/events` bundle" [V `research/plan-v2.md:123`]. Plant [S].
- Difficulty: 2 · Static-detectable: yes

### P-03 The server takes ten seconds to boot
- Type: A · Class: perf · Primitive(s): Nitro plugins, Nitro cache
- Fixture: Meetups, new `server/plugins/warm.ts`. At boot it awaits a scan of every event to build the city list, renders the three email templates and calls the rates service. The verifier's rates stub hangs for 4 s. 25 lines.
- Report given to the agent (A only): "after every deploy the site is down for about 10 seconds. the health check fails and the host restarts it, sometimes twice"
- Root cause: Nitro plugins finish before the server takes requests, and this one awaits a table scan and an outbound call.
- Why it gets written: W1, W6. Warming a cache at startup is a habit from long-lived servers, and in dev the process never restarts.
- Verification: spawn `node .output/server/index.mjs` on the seeded database with the hung rates stub. Time from spawn to the first 200 on `/api/cities` is at most 1,500 ms [G, set the budget at the midpoint once measured]. The stub sees no request before the first inbound one. The second `/api/cities` call answers in under 50 ms.
- Solutions:
  - [best] delete the warm-up and compute on first use behind `defineCachedFunction`, as reference `server/api/cities.get.ts:7-12` and `rates.get.ts:12-24` [V]
  - [acceptable] keep the warm-up, start it without awaiting it, catch its errors
  - [over-engineered] a Schedule that refreshes a KV copy every few minutes
  - [masks-symptom] raise the host's health-check timeout
  - [wrong] move the awaits into a middleware · every first request on every instance now pays
- Agent traps: measures request latency, which is fine, and never restarts the server.
- Evidence: ViteHub `1e807fc` "perf(workflow): load the registry definitions on the first run (#3679)" is the same class inside ViteHub [R]. Plant [S].
- Difficulty: 3 · Static-detectable: partly

### P-04 A CSV export freezes the site
- Type: A · Class: perf · Primitive(s): h3 response, Database
- Fixture: Meetups, `server/api/events/[slug]/attendees.csv.get.ts`. The date cell builds a `new Intl.DateTimeFormat(...)` per row. Seed one event with 150,000 attendees. 3 lines.
- Report given to the agent (A only): "when the conference organizer downloads the attendee list, the whole site hangs for everyone for a few seconds"
- Root cause: constructing a formatter per row is seconds of synchronous work on the one thread that serves every request.
- Why it gets written: W1. Formatting inline reads well and ten seed rows take no time.
- Verification: while one export runs, 200 requests to `/api/events/<other>/seats` have p95 at most 100 ms. The export finishes in under 2 s [G]. The CSV bytes equal the base's output for the same seed.
- Solutions:
  - [best] build the formatter once outside the loop, or use `toISOString()` as the reference does at line 18 [V] · one line
  - [acceptable] stream the rows in pages through a `ReadableStream` · also bounds memory, more code than the report needs
  - [over-engineered] a Queue job that writes the file to Blob and emails a link
  - [masks-symptom] `await` a `setImmediate` every 1,000 rows · other requests get through, the export is as slow, so the duration check fails
  - [wrong] cache the CSV · private data, stale on the next RSVP
- Agent traps: reaches for streaming or a job first. This case exists to rank a one-line fix above a correct larger one.
- Evidence: babysitter `164146e12` "read babysitter token usage incrementally off the event loop" [R, same class]. Plant [S].
- Difficulty: 3 · Static-detectable: partly

### P-05 The rates cache stampedes
- Type: both · Class: perf · Primitive(s): Nitro cache
- Fixture: Meetups, `server/api/rates.get.ts`. `defineCachedFunction` becomes two module variables: `if (!cached || Date.now() - at > TTL) cached = await fetchRates()`. The rates stub takes 2 s and counts hits. 10 lines.
- Report given to the agent (A only): "the rates provider bill tripled. their dashboard shows bursts of 40 calls in the same second, at the top of every hour"
- Root cause: an `await` sits between the check and the assignment, so every request that arrives during a refresh starts its own upstream call. The cache also belongs to one process.
- Why it gets written: W4, W6. A module variable is the first cache anyone writes, and requests in dev never overlap.
- Verification: 50 concurrent requests on a cold cache give 1 stub hit. After the TTL, 50 more give 1 more hit. With the stub never answering, pages still answer in under 3 s with euro prices, as rubric C2 asks [V `tasks/meetups/RUBRIC.md:178`].
- Solutions:
  - [best] `defineCachedFunction(fn, { maxAge, swr: true })` plus a timeout, as reference `rates.get.ts:12-24` [V] · one pending call per key [G, confirm in Nitro's cache before building]
  - [acceptable] cache the promise, not the value · no stampede, still per process
  - [acceptable] a KV value refreshed by a Schedule
  - [over-engineered] a KV lock with retries
  - [masks-symptom] a longer TTL · fewer bursts of the same size
- Agent traps: adds a timeout, sees one request work, and leaves the race.
- Evidence: plan v2 F7 "The upstream is called at most once in 10 minutes over 50 requests" [V `research/plan-v2.md:122`]. Plant [S]. Neighbour: grok P04, which plants no cache at all.
- Difficulty: 3 · Static-detectable: yes

### P-06 The home page polls 24 times a second
- Type: A · Class: perf · Primitive(s): none needed, Realtime as a trap
- Fixture: Meetups, `app/components/EventCard.vue` gets a copy of the event page's seat refresher at 1 s with no visibility check. 12 lines.
- Report given to the agent (A only): "server CPU is pinned whenever a few people leave the home page open. the access log is all /seats"
- Root cause: 24 cards each poll once a second per open tab, hidden tabs included.
- Why it gets written: W7. The pattern works on the event page, so someone copies it into the card.
- Verification: Playwright on `/` for 20 s sees at most 1 request to `/api/events/*/seats`. A hidden tab makes 0 requests in 20 s. On the event page a second browser's RSVP still shows within 10 s, rubric P14 [V `RUBRIC.md:43`].
- Solutions:
  - [best] remove the poll from the card, since the list response already has `seatsLeft`, and keep the page's visible-only 5 s poll [V `app/components/RsvpPanel.vue:25-29`]
  - [acceptable] one batched request for the cards in view, paused when hidden · only if live counts on the list are a product need
  - [acceptable] one server-sent event stream per page
  - [over-engineered] WebSockets or ViteHub Realtime · Realtime "is not a general-purpose WebSocket or event-broadcasting API" [V `packages/realtime/README.md:12`]
  - [masks-symptom] a 10 s interval, or a 1 s cache on `/seats` · the storm stays, smaller
- Agent traps: reaches for Realtime because the prompt world says "live".
- Evidence: plant [S].
- Difficulty: 2 · Static-detectable: yes

### P-07 The list serves full-size cover photos
- Type: both · Class: perf · Primitive(s): Blob serve variants
- Fixture: Meetups, `app/components/EventCard.vue` and `EventCover.vue`. `coverUrl(path, 640)` becomes `/images/${path}`, and `width`, `height` and `loading` go. Seed covers of 3 to 4 MB. 6 lines.
- Report given to the agent (A only): "home page takes forever on mobile data. devtools says 60 MB"
- Root cause: every card downloads the original upload, and all 24 load at once.
- Why it gets written: W7. The stored path works as a URL, so the variant parameter looks optional.
- Verification: Playwright at 390 by 844 on `/`. Image bytes for the first screen are at most 1.5 MB [G]. No card image is wider than 1,280 px. Images below the fold are not requested before a scroll. Layout shift is 0. The event page's cover is unchanged.
- Solutions:
  - [best] the Blob serve route's `?w=` variants with `width`, `height` and `loading="lazy"`, as reference `shared/utils/cover.ts:7-9` and `EventCard.vue:23-27` [V]
  - [acceptable] `?w=640` alone
  - [over-engineered] resize at upload into three stored files with a Queue job, or a second image pipeline through `@nuxt/image`
  - [masks-symptom] `loading="lazy"` alone · fewer requests, each still 4 MB
  - [wrong] CSS width
- Agent traps: does not know the serve route resizes, and builds a resizer.
- Evidence: reference config comment "resized variants (?w=640) made by sharp" [V `nuxt.config.ts`, blob block]. ViteHub variant code [V `packages/blob/src/media/variant.ts:44`, `responsive.ts:113-123`]. Drop `5c86a12a` "load images as the reader nears them" [R]. Plant [S].
- Difficulty: 2 · Static-detectable: yes

### P-08 Covers download again on every visit
- Type: A · Class: perf · Primitive(s): Blob serve headers, route rules
- Fixture: Meetups, `nuxt.config.ts`. The production `"/**"` headers gain `"Cache-Control": "no-store"`, added to stop a stale dashboard. 1 line. Which header wins between a route rule and Blob's `serve.headers` needs a check; if Blob wins, plant it in `blob.serve.headers` [G].
- Report given to the agent (A only): "bandwidth doubled since last week's release and nothing else changed"
- Root cause: one blanket rule made the immutable cover URLs uncacheable.
- Why it gets written: W10 in reverse. A stale page gets fixed with the widest rule that works.
- Verification: `/images/<cover>?w=640` may be cached, by `max-age` of a day or more or by an ETag that answers 304. A second Playwright visit to `/` transfers 0 image body bytes. `/api/dashboard` and the CSV stay `no-store` or `private`. Error responses are not cacheable.
- Solutions:
  - [best] drop the blanket rule and put `no-store` on the personal routes that needed it. Blob keeps its immutable header, as reference `nuxt.config.ts` blob block [V].
  - [acceptable] keep the blanket rule and add a narrower `/images/**` rule
  - [acceptable] ETag revalidation on images, as Drop does
  - [masks-symptom] a CDN in front
  - [wrong] `public, max-age=31536000` on `"/**"` · caches personal pages and errors
- Agent traps: fixes the images and makes the dashboard cacheable.
- Evidence: Drop `82f67277` "files revalidate instead of downloading again on every visit", with the follow-up "keep ETagged error responses uncacheable" in the same PR [R].
- Difficulty: 2 · Static-detectable: yes

### P-09 The event page waits on four requests in a row
- Type: A · Class: perf · Primitive(s): Nuxt data fetching, Database
- Fixture: Meetups, `app/pages/events/[slug]/index.vue`. The one `/api/events/:slug` call is split into four awaited `useFetch` calls, each with its own route. The verifier adds 80 ms to every database call. 20 lines and 3 small route files.
- Report given to the agent (A only): "the event page takes about a second before anything loads in production. the database is in another region. locally it's instant"
- Root cause: four requests run one after another during server rendering, and only the slug connects them.
- Why it gets written: W1, W7. One `await useFetch` per line reads well, and local SQLite hides the chain.
- Verification: with 80 ms per database call, time to first byte of `/events/<slug>` is at most 250 ms (planted about 500 ms [G]). The SSR HTML still holds the title and OG tags. The browser makes no second request for the data, rubric D2 [V `RUBRIC.md:63`].
- Solutions:
  - [best] one endpoint with its independent reads in `Promise.all`, as reference `[slug]/index.get.ts:12-16` [V]
  - [acceptable] keep four endpoints and start them together
  - [over-engineered] read replicas or an edge cache
  - [masks-symptom] `lazy: true` · the first byte is fast because the data left the HTML, and the OG check fails
  - [wrong] `server: false`
- Agent traps: `lazy`. It makes the timing number pass and the page worse.
- Evidence: Drop `a4996961` "a shared doc's page waits for 3 database round trips instead of 11" [R]. Drop `57be0e1f` [R]. Plant [S]. Neighbour: grok P05, the same waterfall inside one handler.
- Difficulty: 2 · Static-detectable: yes

### P-10 A missing index, fixed with a real migration
- Type: both · Class: perf · Primitive(s): Database migrations
- Fixture: Meetups variant with a "My RSVPs" endpoint and without `rsvps_user_idx` in the schema, the migration and its snapshot. 200,000 RSVPs. The verifier also holds a database file migrated at this base state, standing in for production.
- Report given to the agent (A only): "My RSVPs takes 3 seconds for everyone, even people with one RSVP"
- Root cause: `where user_id = ?` scans the table, because the only index starts with `event_id`.
- Why it gets written: W1, W11. The unique index on `(event_id, user_id)` looks like it covers the query.
- Verification: `EXPLAIN QUERY PLAN` of the endpoint's SQL, taken from the query log, has no `SCAN rsvps`. `pnpm db:migrate` works on the production copy and keeps its rows, and on a fresh database. `pnpm db:generate` then produces nothing. Migration 0000 is byte-identical to the base.
- Solutions:
  - [best] add the index to the Drizzle schema, generate a new migration, commit both, as the reference declares it at `server/databases/config.ts:76` [V]
  - [acceptable] a hand-written migration with the snapshot kept in step
  - [masks-symptom] a per-user cache, or a `LIMIT 10` that still scans
  - [wrong] edit `0000_*.sql` · fresh databases get the index and production never does
  - [wrong] `CREATE INDEX IF NOT EXISTS` in a server plugin at boot
- Agent traps: edits the schema file and stops. Tests pass on its fresh database.
- Evidence: Drop `1e14bda4` "move the teams schema into 0001_teams.sql so databases that applied 0000 get it" [R]. Drop's plan assertion `assert.doesNotMatch(plan, /SCAN (drops|"drops")\b(?! USING)/)` [R `test/cost/round-trips.test.mjs`]. Scripts [V reference `package.json:14-15`].
- Difficulty: 3 · Static-detectable: partly

### P-11 The reminder tick does not scale
- Type: A · Class: perf · Primitive(s): Schedule, Queue, Database
- Fixture: Meetups, `server/schedules/event-reminders.ts`. The time window moves from SQL into a JavaScript loop over every future RSVP, with one extra query per row. Seed 200,000 RSVPs, 5,000 due. 12 lines.
- Report given to the agent (A only): "reminder emails arrive hours late on busy days. some people get them after the event"
- Root cause: each 15-minute tick loads every future RSVP and runs one query and one enqueue per row in series, so a tick outlasts its interval.
- Why it gets written: W1, W7. Filtering in JavaScript is easier to read than three SQL conditions, and the seed has ten RSVPs.
- Verification: run the tick once with `vitehub schedule run event-reminders` [V reference schedule, `manual: true`]. It makes at most 3 database calls and reads at most the due rows plus a small constant, both from the query log. It queues exactly 5,000 jobs. A second run queues 0.
- Solutions:
  - [best] the window and `isNull(reminderSentAt)` in SQL, as reference `event-reminders.ts:18-24` [V], with the enqueues in bounded parallel chunks
  - [acceptable] the SQL filter with serial enqueues
  - [acceptable] one job per event that mails its attendees
  - [over-engineered] a Workflow per event that sleeps until a day before
  - [masks-symptom] a cron every minute, or `LIMIT 500` per tick · the backlog grows where nobody sees it
- Agent traps: speeds the loop with `Promise.all` over 200,000 rows and exhausts the database.
- Evidence: babysitter `94cf746a1` "walked the whole invocation journal (20k rows ...) every minute; it now lists only rows updated since its last read" [R]. email-labeller `8882c29` "process Gmail history in bounded batches" [R]. Plant [S].
- Difficulty: 3 · Static-detectable: yes

### P-12 A search cache that never forgets
- Type: both · Class: perf · Primitive(s): Nitro cache
- Fixture: Meetups, `server/api/events/index.get.ts` gets `const cache = new Map()` keyed by the raw query string, with no expiry. 8 lines.
- Report given to the agent (A only): "the server gets killed for memory every couple of days. also someone saw seats on an event that was full"
- Root cause: a per-process Map keyed by anything a visitor types grows without limit and returns seat counts from the first time a key was seen.
- Why it gets written: W6, W10. A Map is the fastest patch for a slow search.
- Verification: start the server with `--max-old-space-size=128` and send 30,000 distinct queries. The process stays up and its resident memory, read from `/proc`, stays under 300 MB. An RSVP followed by the same list query shows one seat fewer.
- Solutions:
  - [best] delete the cache · the query is indexed and paged, and needs none
  - [acceptable] `defineCachedFunction` with a short `maxAge` on a normalised key, for the user-independent part only
  - [over-engineered] an LRU dependency with invalidation on every RSVP
  - [masks-symptom] clear the Map hourly, restart nightly, or raise the memory limit
- Agent traps: bounds the cache and keeps the stale seats. The report's second sentence is the tell.
- Evidence: Drop `1892ddcc` "the GitHub membership cache prunes expired tokens" [R]. babysitter `6e25c2444` "contain Babysitter worker memory" [R, class]. Plant [S].
- Difficulty: 2 · Static-detectable: yes

### P-13 An activity feed kept in one KV value
- Type: both · Class: perf · Primitive(s): KV, Database
- Fixture: Meetups variant with an organizer activity feed. Each RSVP does `kv.get("activity:<eventId>")`, pushes an entry and calls `kv.set`. Seed one event with 20,000 entries, about 1.5 MB. 15 lines.
- Report given to the agent (A only): "RSVPing to the big conference takes 2 seconds, small events are instant. and the organizer says names are missing from the feed"
- Root cause: every RSVP reads, parses and rewrites the whole list, and two RSVPs at once each write back their own copy.
- Why it gets written: W4, W7. A get and set API invites storing the array.
- Verification: RSVP latency at 20,000 entries is within 1.5 times the latency at 10. 50 concurrent RSVPs add 50 feed entries. The feed returns the latest 50 in order. No KV value for the event is over 64 KB.
- Solutions:
  - [best] read the feed from the `rsvps` table, which already has the user and `createdAt` · no second store
  - [acceptable] an `activity` table with an index
  - [acceptable] one KV key per entry under a prefix
  - [over-engineered] a Queue job that appends
  - [masks-symptom] keep the last 100 in the array · bounded, and still loses concurrent writes
- Agent traps: fixes the size and misses the lost update. The 50-concurrent check catches it.
- Evidence: babysitter `70a0c2fde` "append to Agent State lists without rewriting them (vite-hub/vitehub#2519)" [R]. ViteHub #2519 "perf(agent): append to a SQLite state list without rewriting it" [R]. `kv` export [V `packages/kv/src/index.ts:1`]. Plant [S].
- Difficulty: 3 · Static-detectable: yes

### Real fixes in a large app (Drop)

Drop is public (`vite-hub/drop`), so these cases need web access off or a renamed private copy. See open question 1.

### D-01 Drop: a shared doc waits for 11 round trips
- Type: A · Class: perf · Primitive(s): Database on D1
- Fixture: `vite-hub/drop` at the parent of `a4996961`, which is `82f67277`. No plant: the code is as it was. 50,600 lines.
- Report given to the agent (A only): "opening a shared doc takes more than half a second before anything shows, and from far away it's worse"
- Root cause: the link, its version chain, the folders above the doc, comments, replies and author pictures each load in their own awaited query.
- Why it gets written: W1. Each helper is clean alone, and D1 charges about 55 ms per sequential round trip [R test comment].
- Verification: the fix's own `test/cost/round-trips.test.mjs` [R]. It counts round-trip waves through a Drizzle `sqlite-proxy` and asserts `{ link: 1, detail: 2, comments: 2, image: 1, page: 3 }` and no table scan. `test/cost/harness.mjs` exists at the parent [V]. For the gate I would accept page at most 4, so correct fixes of another shape pass, and keep 3 as the best-class mark.
- Solutions:
  - [best] the real fix: the drop and its ancestors in one query, the link key without the version walk, independent reads in `Promise.all` [R diff]
  - [acceptable] `Promise.all` alone · fewer waves, more queries than the best [G on its count]
  - [over-engineered] a KV cache of the doc detail with invalidation
  - [masks-symptom] Smart Placement or read replicas alone · each trip is cheaper and the count stays. Drop shipped both as well, in `57be0e1f` and `f949cdb7` [R].
  - [wrong] cache a response that carries per-user permissions
- Agent traps: cannot see latency locally and declares it fine. Changes permission logic while merging queries.
- Evidence: all [R].
- Difficulty: 4 · Static-detectable: partly

### D-02 Drop: a crashed publish keeps its quota
- Type: A · Class: bug · Primitive(s): Database, Schedule
- Fixture: Drop at the parent of `983468e5`.
- Report given to the agent (A only): "a user can't publish, it says storage full, but their drops add up to half the plan"
- Root cause: a publish reserves quota first, and nothing releases the reservation when the publish dies midway.
- Why it gets written: W4, W5. Reserve, upload, commit is correct on the happy path, and a Worker can stop between any two awaits.
- Verification: the commit's `test/quotas/reservations.test.mjs`, 58 new lines, and its changes to `test/quotas/limits.test.mjs` [R].
- Solutions:
  - [best] reservations carry a time, the quota SQL ignores expired ones, and the hourly cleanup removes them. The commit touches `server/utils/quota-sql.ts`, `quotas.ts` and `server/schedules/code-image-cleanup.ts` [R stat; G on the detail, I read the stat and not the whole diff].
  - [masks-symptom] release in a `finally` · a killed isolate never runs it
  - [over-engineered] a Workflow with a compensation step per publish
  - [wrong] count quota without reservations · two publishes at once overshoot
- Agent traps: `finally`. It passes a test that throws and fails one that stops.
- Evidence: [R].
- Difficulty: 4 · Static-detectable: partly

### D-03 Drop: readers download the editor
- Type: A · Class: perf · Primitive(s): Nuxt code splitting, Realtime
- Fixture: Drop at the parent of `6b331bbd`.
- Report given to the agent (A only): "shared docs load slowly on phones, and most visitors only read"
- Root cause: `useLiveEditor` imports Tiptap, ProseMirror, Yjs and the room at the top of a composable the reader page uses.
- Why it gets written: W7. A composable's imports are static unless someone makes them dynamic.
- Verification: build before and after. The shared-doc route's static JS drops by at least 25%, and no Tiptap, ProseMirror or Yjs module remains in its static import graph. The editor still opens. Needs one build per run, about 2.5 GB.
- Solutions:
  - [best] load the editor and the room on open, as the commit does in `app/composables/useLiveEditor.ts` and `app/utils/live-room.ts` [R]
  - [acceptable] a lazy component around the editor
  - [masks-symptom] preload hints
  - [wrong] `ssr: false` on the page
- Agent traps: a dynamic import that still pulls Yjs through a shared type-only-looking module.
- Evidence: [R]. Drop `d673ddc8` "without them the Worker bundles a second Yjs" is a related trap [R].
- Difficulty: 3 · Static-detectable: yes

### ViteHub corners

### N-01 A mail error is logged and the job succeeds
- Type: both · Class: nook · Primitive(s): Email, Queue
- Fixture: Meetups, `server/utils/mail.ts`. In the error branch the claim release and `throw error` go, and `console.error` stays. 2 lines.
- Report given to the agent (A only): "Resend was down for ten minutes on Tuesday. nobody who RSVPed then got a confirmation, and nothing retried"
- Root cause: `email.send()` returns `[error]` and does not throw. The job returns, the Queue records a success, and the RSVP stays marked as sent.
- Why it gets written: W3. Logging the error looks like handling it. Doctor's VHUB0003 accepts `const [error] = await ...`, so this form passes the linter [V main `doctor-rules.md`, VHUB0003].
- Verification: a mail stub that fails twice then accepts delivers exactly 1 mail, and `confirmation_sent_at` is set. A stub that always fails leaves the job dead after 4 attempts [V `packages/queue/src/providers/local.ts:155`] and the column null. Running the job twice still sends 1 mail.
- Solutions:
  - [best] release the claim and rethrow, so the Queue retries, as reference `mail.ts:63-68` [V]
  - [acceptable] send first, mark after, with a guard that keeps the duplicate-job test green
  - [over-engineered] an outbox table swept by a Schedule, or a Workflow with steps
  - [masks-symptom] a `setTimeout` retry inside the handler · dies with the process
  - [wrong] wrap the call in `try`/`catch` · nothing throws
- Agent traps: `try`/`catch`. It is the reflex from every other mail library.
- Evidence: the v2 rubric added "send() errors" among its ViteHub checks [R nuxt-evals `38f825d`]. email-labeller `552e464` "patch vite-hub to log errors with their cause and retry" [R, class].
- Difficulty: 2 · Static-detectable: yes

### N-02 Rate limits that never limit, in three forms
- Type: B, with an A variant · Class: nook · Primitive(s): Rate Limit
- Fixture: Meetups, three handlers. `requireRateLimit(...)` without `await`. `if (!(await checkRateLimit(...))) throw`. `createRateLimiter({ driver: memoryRateLimitDriver() })` built inside the handler. 1 to 3 lines each.
- Report given to the agent (A only): "someone hammered the RSVP endpoint 5,000 times last night. I thought we had a limit"
- Root cause: an unawaited guard checks nothing, a Result is always truthy, and a limiter made per request starts from zero each time.
- Why it gets written: W3. All three are documented mistakes [V main `doctor-rules.md`, VHUB0006, VHUB0008, VHUB0009].
- Verification: A variant, 30 requests in a minute and the 21st answers 429. B, the manifest. Doctor reports all three, so this is the linter-visible tier. Report recall on it apart from the plants Doctor cannot see.
- Solutions:
  - [best] `await requireRateLimit(event.req, name, { limit, window, key })`, as reference `rsvp.post.ts:11` [V]
  - [acceptable] destructure `[error, decision]` and check `decision.allowed`
  - [over-engineered] a hand-written KV counter
  - [wrong] `if (decision)`
- Agent traps: finds one form and stops looking.
- Evidence: exports at the pin [V `packages/rate-limit/src/guard.ts:135,139`, `limiter.ts:234`, `drivers/memory.ts:23`]. Plants [S].
- Difficulty: 1 · Static-detectable: yes

### N-03 The build fails with VITE_HUB_R0137
- Type: A · Class: dx · Primitive(s): Schedule
- Fixture: Meetups, `nuxt.config.ts`. `schedule: { runtime: { driver: "process" } }` becomes `schedule: true`, as a config clean-up would. The fixture's cron runs every minute. 1 line.
- Report given to the agent (A only): the build output, then "build broke after the config cleanup PR. just make it build"
- Root cause: a Node host has no cron, and ViteHub refuses to build Schedules that nothing would run [V `packages/vite-hub/src/index.ts:653`, `docs/content/docs/schedule/hosts.md:30`].
- Why it gets written: W6. `schedule: true` works in dev, where the dev server runs everything.
- Verification: the build passes, and the built server sends a due reminder to the mail stub within 90 s.
- Solutions:
  - [best] set the process driver back, as the error text says
  - [acceptable] an outside cron that calls a guarded route which runs the tick [G]
  - [over-engineered] a `setInterval` in a server plugin
  - [wrong] `schedule: false`, or deleting the schedule file · the build is green and reminders are gone
  - [wrong] a different preset to silence the error
- Agent traps: removes the feature to get a green build. The report invites it.
- Evidence: [V] as above. Plant [S].
- Difficulty: 1 · Static-detectable: yes

### N-04 "Emails don't arrive on my machine" is not a bug
- Type: A, control · Class: dx · Primitive(s): Email
- Fixture: the unplanted base.
- Report given to the agent (A only): "I RSVP on my machine with pnpm dev and never get the confirmation email. production is fine. fix it"
- Root cause: none in the code. In dev, mail stays in ViteHub's outbox and no provider request goes out unless `remote: true` is set [V `docs/content/docs/email/get-started.md:51`].
- Why it gets written: W6. Told to fix something, an agent changes code.
- Verification: no change under `server/` or to `nuxt.config.ts` beyond comments or docs. The pass-to-pass suite is green. The final message names the outbox and how to read it, `vitehub email outbox list` [V `RUBRIC.md:52`], or `remote: true` as an opt-in. A judge checks those facts.
- Solutions:
  - [best] no code change, an explanation, and at most a README line
  - [acceptable] an opt-in env flag that sets `remote: true` for a dev session
  - [masks-symptom] print the mail body to the console
  - [wrong] hard-code `remote: true` · dev now mails the seeded users
  - [wrong] replace `email.send` with a direct provider call
- Agent traps: any diff at all.
- Evidence: [V] as above. Case design [S].
- Difficulty: 2 · Static-detectable: no

### Migrations

### M-01 A ViteHub upgrade across the Queue rename
- Type: A · Class: migration · Primitive(s): Queue, codemods
- Fixture: Meetups at `1e807fc`. The task bumps `vite-hub` to a newer pinned commit.
- Report given to the agent (A only): "bump vitehub to <commit>. the build breaks on runQueue"
- Root cause: the pin exports `runQueue` [V `packages/queue/src/index.ts:8`]. Main exports `sendQueue` and `useQueue` and no `runQueue` [V `origin/main:packages/queue/src/index.ts:3`].
- Why it gets written: W8. A young library renames, and the model remembers neither name.
- Verification: the build and the whole pass-to-pass suite on the new version. No `runQueue` or `runWorkflow` in app code. Doctor's VHUB0033 `no-removed-apis` is clean [V main rule list].
- Solutions:
  - [best] run `npx @vite-hub/codemods`, read its follow-ups and fix what it reports. The `queue-workflow-verbs` codemod exists [V `origin/main:packages/codemods/src/registry.ts`, `docs/content/docs/codemods/index.md`]. Whether it runs against a pkg.pr.new pin is unchecked [G].
  - [acceptable] rename by hand from the type errors and the docs
  - [masks-symptom] a `compat.ts` that exports `runQueue = sendQueue`
  - [wrong] stay on the old pin, or `@ts-expect-error`
- Agent traps: a full lockfile resolution strips pkg.pr.new tarball hashes [R project memory, vitehub#3958, not rechecked]. Other renames between the two pins are unknown to me, so dry-run the reference first [G].
- Evidence: [V] as above.
- Difficulty: 3 · Static-detectable: yes

### M-02 Someone edited a migration that production had applied
- Type: A · Class: migration · Primitive(s): Database migrations
- Fixture: Meetups. `0001_square_riptide.sql`, which creates the `passkey` table [V], is folded into `0000` and deleted. The verifier holds a database file migrated with the original `0000` only.
- Report given to the agent (A only): "fresh clones work. production says no such table: passkey since yesterday's deploy"
- Root cause: production recorded `0000` as applied, so the edited `0000` never runs there.
- Why it gets written: W11. Folding migrations looks like tidying, and every fresh database agrees.
- Verification: `db:migrate` on the production copy creates the table and keeps the rows. A fresh database migrates too. `db:generate` then produces nothing. `0000` matches its original hash.
- Solutions:
  - [best] restore `0000` to what production applied and generate `0001` for the rest, which is Drop's fix
  - [acceptable] restore `0000` and write `0001` by hand
  - [masks-symptom] run the SQL by hand on production · the next environment breaks the same way
  - [wrong] delete the migration record so `0000` runs again
  - [wrong] `CREATE TABLE IF NOT EXISTS` throughout `0000`
- Agent traps: reproduces on a fresh database and sees nothing wrong.
- Evidence: Drop `1e14bda4` "#28 added the teams tables and columns to 0000_init.sql, which production D1 had already applied, so drop.vitehub.dev queried drops.team_id and failed" [R]. Neighbours: SOL-24, SOL-26.
- Difficulty: 3 · Static-detectable: partly

### M-03 Upload checks written before the Blob helpers
- Type: A · Class: migration · Primitive(s): Blob
- Fixture: Meetups, `server/api/events/[slug]/cover.put.ts` with a 40-line validator: size from `content-length`, type from the extension and `file.type`, and its own magic-byte table without WebP.
- Report given to the agent (A only): "clean up the cover upload checks, we wrote them before vitehub had helpers for this. also webp photos get refused"
- Root cause: hand-written validation that predates `ensureBlob` and `detectContentType`, with a gap.
- Why it gets written: W8. The code is older than the helper, and nothing tells the reader a helper now exists.
- Verification: JPEG, PNG and WebP pass. A PNG declared as JPEG, an HTML file declared as PNG and a 5 MB photo are refused with a reason. Net lines in the file go down.
- Solutions:
  - [best] `ensureBlob(file, { maxSize, types })` plus `detectContentType(bytes)`, as reference `cover.put.ts:22-23` [V] and [V `packages/blob/src/ensure.ts:15`, `content-type.ts:24`]
  - [acceptable] add WebP to the table · fixes the bug and skips the clean-up
  - [over-engineered] a `file-type` dependency plus a decode with sharp
  - [wrong] trust `file.type`
- Agent traps: fixes the WebP line and reports done.
- Evidence: [V] as above. Plant [S].
- Difficulty: 2 · Static-detectable: yes

### Security with a measurable check

### S-01 Forgot password answers slower for real accounts
- Type: both · Class: security · Primitive(s): Auth, Email
- Fixture: Meetups, `server/auth.ts`. The reset request waits for the mail. How to plant it depends on how Better Auth 1.7 runs `sendResetPassword`, which I did not read [G]. The mail stub takes 1,500 ms.
- Report given to the agent (A only): "a pentest says our forgot-password form tells you which emails have accounts"
- Root cause: the response time differs by 1.5 s between a known and an unknown address.
- Why it gets written: W1. `await` in front of a send is the default, and a fast dev mailer hides it.
- Verification: 20 requests each for a known and an unknown address. The medians differ by under 50 ms. Status and body are the same.
- Solutions:
  - [best] the response does not wait for the send, as the reference states at `server/utils/mail.ts:71-80` [V comment]
  - [acceptable] hand the send to the host's `waitUntil`
  - [over-engineered] queue it · the reset token then sits in the queue store [V same comment]
  - [masks-symptom] sleep 1.5 s for unknown addresses · equal on a quiet server, different under load
  - [wrong] answer 404 for unknown addresses
- Agent traps: the sleep.
- Evidence: reference comment [V]. Plant [S].
- Difficulty: 3 · Static-detectable: partly

### S-02 The upload reads the whole body before it checks the size
- Type: both · Class: security · Primitive(s): Blob, h3 request body
- Fixture: Meetups, `cover.put.ts`. It calls `event.req.formData()` and then `ensureBlob` [V lines 18-22]. This may be the reference as it stands, see below.
- Report given to the agent (A only): "someone uploaded a 2 GB 'photo' and the server ran out of memory"
- Root cause: the size check runs after the body is in memory.
- Why it gets written: W7. `formData()` then validate is the form every example uses.
- Verification: post a 300 MB multipart stream. The server answers 413 after accepting at most the limit plus 1 MB, counted by the test client, and its memory grows by under 50 MB. A 3 MB photo still uploads.
- Solutions:
  - [best] cap the body on the route before parsing, with a streaming count and not only `content-length` [G on the h3 v2 option to use]
  - [acceptable] a `content-length` check in the app plus a documented proxy limit
  - [over-engineered] presigned direct uploads
  - [masks-symptom] a rate limit alone
- Agent traps: checks `content-length`, which a chunked request omits.
- Evidence: Drop `3253db64` "uploads stop reading at the limit" [R]. Whether h3, Nitro or ViteHub already caps the body at the pin is unchecked [G]. If nothing does, this is a native weakness of the reference and a rubric gap. Check before using the reference as a clean base.
- Difficulty: 3 · Static-detectable: yes

### Change tasks (type C)

### T-01 Add a waitlist
- Type: C · Class: bug-prone feature · Primitive(s): Database, Queue, Email
- Fixture: the unplanted base.
- Report given to the agent: "when an event is full let people join a waitlist. if someone cancels, the first person waiting gets the seat and an email"
- What makes it hard: the seat rule is one conditional INSERT [V `rsvp.post.ts:18-27`]. Promotion on cancel has to stay as atomic.
- Why it gets written wrong: W4, W5.
- Verification: hidden tests. A full event takes a waiter and shows a position. Ten parallel cancels and joins promote each waiter once and never exceed capacity, so rubric P12 still passes [V `RUBRIC.md:41`]. A promoted guest gets one confirmation through the existing queue. The migration applies on a populated database.
- Solutions:
  - [best] waitlist rows, promotion in the same statement or transaction as the cancel, mail through the `rsvp-confirmation` queue
  - [acceptable] promotion in a Queue job after the cancel with a conditional insert · a seat is briefly empty, never oversold
  - [over-engineered] a Workflow per event
  - [wrong] check-then-insert promotion, or a second mail path that skips the sent-at claim
- Agent traps: builds the UI first and leaves promotion as two queries.
- Evidence: design [S]. The reference's atomic insert [V].
- Difficulty: 4 · Static-detectable: no

### T-02 Co-organizers
- Type: C · Class: security-prone feature · Primitive(s): Auth, Database
- Fixture: the unplanted base.
- Report given to the agent: "let an organizer add co-organizers by email. they can edit the event, see attendees and download the csv. only the owner adds or removes them"
- What makes it hard: ownership is checked in `findOwnedEvent`, called from 5 handlers, and compared directly in 2 more places: `server/api/dashboard.get.ts:20` and `server/api/events/[slug]/index.get.ts:35` [V, from `rg findOwnedEvent\|organizerId`].
- Why it gets written wrong: W9.
- Verification: a hidden matrix. Each organizer-only route against owner, co-organizer, stranger and anonymous, with the expected status in every cell. The dashboard lists co-organized events. The score is the share of correct cells.
- Solutions:
  - [best] a join table, the one helper changed, the two direct comparisons changed, a generated migration
  - [acceptable] the same with a new helper that all seven sites call
  - [over-engineered] Better Auth's `organization()` plugin, whose tables must also go in the Database Definition [V `docs/content/docs/auth/configure.md:225`], or a general roles layer
  - [wrong] a copy of the check per route · misses the two direct comparisons
  - [wrong] a role column on the user · global, not per event
- Agent traps: changes the helper, sees five routes work, and never greps for `organizerId`.
- Evidence: call sites [V]. Design [S]. Neighbour: grok S19 plants a bug in a fixture that already has the feature.
- Difficulty: 3 · Static-detectable: no

### T-03 Delete an event
- Type: C · Class: feature · Primitive(s): Database, Blob, Queue
- Fixture: the unplanted base. It has no delete route [V reference file list].
- Report given to the agent: "organizers need a delete button for their events"
- What makes it hard: three stores hold the event. Rows cascade [V `server/databases/config.ts:67`], the cover is a Blob object, and queued mail jobs still name its RSVPs.
- Why it gets written wrong: W9, W11.
- Verification: only the owner can delete. The RSVPs are gone. The cover is gone from the Blob store. Queued jobs for its RSVPs finish with no retries, since `sendRsvpMail` returns when the row is missing [V `mail.ts:30,46`]. `/e/<id>` and `/events/<slug>` answer 404. The method is DELETE or POST.
- Solutions:
  - [best] `DELETE /api/events/[slug]` through `findOwnedEvent`, the row deleted, then `blob.del(coverPath)`, and a confirm in the UI
  - [acceptable] a soft-delete column with filters at every read · more places to miss, right only if undo was asked for
  - [over-engineered] a Workflow for the clean-up
  - [wrong] the row alone, or a GET link
- Agent traps: forgets the cover. Whether attendees get a mail is undecided in the report, and the right move is to state the choice.
- Evidence: [V] as above. Design [S].
- Difficulty: 2 · Static-detectable: no

### T-04 Add a currency
- Type: C · Class: small change · Primitive(s): none
- Fixture: the unplanted base.
- Report given to the agent: "add japanese yen to the currency picker"
- What makes it hard: the currency list has more than one home: `shared/utils/currency.ts`, the Zod schema and the `symbols=USD,GBP` parameter in `server/api/rates.get.ts:6,16` [V], and the picker. Yen has no minor unit.
- Why it gets written wrong: W7. The picker is the visible place, so the edit starts and ends there.
- Verification: Playwright. Picking JPY shows a yen price with no decimals, the choice survives a reload, and the server HTML is already in yen. A first visit with `ja-JP` picks JPY. The rates stub is asked for JPY. A stub without JPY falls back to euros.
- Solutions:
  - [best] add it to the list and the rates schema · about 8 lines [G]
  - [acceptable] the same, and derive the schema from the list so one place remains
  - [over-engineered] a currencies table, or fetching every currency the provider has
  - [wrong] the picker alone, or a hard-coded rate in the browser
- Agent traps: `toFixed(2)`.
- Evidence: files [V]. Design [S]. This is the cheapest case here and close to the most common request: a small change in code the agent did not write.
- Difficulty: 1 · Static-detectable: no

### T-05 Add passkey sign-in
- Type: C · Class: nook-prone feature · Primitive(s): Auth, Database
- Fixture: the reference without passkeys: no plugin, no `passkey` table, no migration `0001`, no account-page section. The reference itself is the known best answer.
- Report given to the agent: "let people sign in with a passkey too, and manage their passkeys on the account page"
- What makes it hard: `authDatabase()` adds only the core Auth tables. A plugin's table belongs in the app's Database Definition under Better Auth's model name [V reference `server/databases/config.ts:17-20,80-82`; V `docs/content/docs/auth/configure.md:225`].
- Why it gets written wrong: W8, W11. Better Auth's own docs say to run its CLI migration, which is the wrong path here [G on what its docs say today].
- Verification: rubric P25 with Playwright's virtual authenticator [V `RUBRIC.md:50`]. The migration applies on a populated database. The `rpID` comes from the public site URL.
- Solutions:
  - [best] the `passkey()` plugin, the table in `defineDatabase` and a generated migration, `rpID` and `origin` from the site URL, as reference `server/auth.ts:28-29` [V]
  - [acceptable] the same with a hand-written migration
  - [over-engineered] WebAuthn by hand
  - [wrong] the plugin without the table · "A table that the Database does not have fails when Better Auth uses it" [V `configure.md:225`]
  - [wrong] the default `rpID` of `localhost` · works on the agent's machine only [V reference comment]
- Agent traps: both wrong entries pass a quick local try, or fail late.
- Evidence: [V] as above.
- Difficulty: 4 · Static-detectable: partly

### T-06 Refactor the mail code without changing what it does
- Type: C · Class: refactor · Primitive(s): Email, Queue
- Fixture: Meetups with `server/utils/mail.ts` unrolled into two near-copies of 45 lines, `sendConfirmation` and `sendReminder`. The reference's `kinds` table is the inverse [V `mail.ts:13-16`].
- Report given to the agent: "mail.ts repeats itself. clean it up, don't change behaviour"
- What makes it hard: four branches must survive in both paths: the claim, the release on failure, the cancelled RSVP, the started event.
- Why it gets written wrong: a merge of two almost equal functions drops the line in which they differ.
- Verification: gate, 8 hidden tests, one per branch per mail kind. Then metrics: duplicated tokens in the module under a threshold, the module at most 0.7 times its length, the queue files' imports unchanged, the diff inside the mail module and its two callers.
- Solutions:
  - [best] one function with the kind as data, as the reference
  - [acceptable] a shared middle with two thin wrappers
  - [over-engineered] a notification framework with classes and new files
  - [wrong] a merge that loses a branch, or a refactor that also edits subjects and templates
- Agent traps: rewrites more than was asked.
- Evidence: reference [V]. Design [S].
- Difficulty: 2 · Static-detectable: no

### T-07 Write tests, scored by the bugs they catch
- Type: C · Class: tests · Primitive(s): Database, Queue, Email
- Fixture: the base with Vitest set up and one example test.
- Report given to the agent: "we have no tests for RSVP and the mails. add some"
- What makes it hard: a test that mocks the database passes on every bug.
- Why it gets written wrong: mocks are the fastest way to a green run.
- Verification: the tests pass on the base 5 times out of 5 and finish in 60 s. Then they run against the A-corpus plants in those files as mutants: oversell, double click, started event, cancel then rebook, swallowed mail error, duplicate job, reminder window. The score is mutants killed over mutants.
- Solutions:
  - [best] request-level tests on a real SQLite file, mail stubbed at the provider, one concurrency test
  - [acceptable] handler tests on an in-memory database
  - [over-engineered] a full Playwright suite for server rules
  - [masks-symptom] tests with a mocked database, or snapshots of response bodies · they kill almost nothing
- Agent traps: sleeps and real timers, which the 5-run check exposes.
- Evidence: design [S]. Every A case is also a mutant, so this eval costs no new plants.
- Difficulty: 3 · Static-detectable: no

### T-08 Review a pull request
- Type: B, scoped to a diff · Class: review · Primitive(s): several
- Fixture: the base plus a 350-line branch that adds event comments, with 5 plants and 2 decoys. One plant is visible only by opening a helper outside the diff.
- Report given to the agent: "review this PR before I merge it", with `git diff main...comments`
- Root cause: per plant. Candidates: a delete route without the owner check, an unchecked `email.send` tuple, one author query per comment, a module-level `ref` for the draft, comment numbers from a read-then-insert.
- Why it gets written: W3, W4, W9.
- Verification: comments as `{ file, line, severity, body }`, matched to the manifest as in B, plus one approve or request-changes answer.
- Solutions: not a fix task. A best review finds the plants, ranks the owner check first, and leaves the decoys alone.
- Agent traps: style comments that bury the real finding.
- Evidence: Drop `1892ddcc` "Comment numbers come from the insert itself instead of a 5-try retry loop" [R] for the last plant. Design [S].
- Difficulty: 3 · Static-detectable: yes

### T-09 "Can a guest get two reminder emails?"
- Type: C, explain only · Class: comprehension · Primitive(s): Queue, Schedule, Email
- Fixture: the unplanted base.
- Report given to the agent: "a guest says she got the reminder twice. can that happen? don't change anything yet"
- What makes it hard: the honest answer is "almost never, and here is the one way".
- Why it gets written wrong: an agent asked about a bug tends to find one.
- Verification: a fact list for the judge. The job claims `reminder_sent_at` in one UPDATE before sending [V `mail.ts:27-30`]. The schedule's `idempotencyKey` stops overlapping ticks while a job waits or runs [V `event-reminders.ts:26-27`, `docs/content/docs/queue/server-api.md:159`]. The remaining way: the provider accepts the mail and its answer is lost, the claim goes back, the retry sends again [my reading of `mail.ts:63-68`]. No file changes.
- Solutions:
  - [best] those three facts with file and line
  - [acceptable] "no" with the first two
  - [wrong] an invented race, or a diff
- Agent traps: inventing a bug to be helpful.
- Evidence: [V] as above. Design [S].
- Difficulty: 2 · Static-detectable: no

### B-01 The clean base, with nothing planted
- Type: B, control · Class: all · Primitive(s): all
- Fixture: the comment-stripped base with no plants and the same prompt as every B run.
- Root cause: none planted.
- Why it gets written: not applicable.
- Verification: count the findings by judge category: real and native, speculative, style. The count of speculative findings is the agent's false-positive floor, and precision on planted fixtures reads against it.
- Solutions: the best report is short, or empty with a sentence on what was read.
- Agent traps: padding to look thorough.
- Evidence: design [S]. A confirmed native finding gets fixed in the base and becomes a plant candidate. S-02 may be the first.
- Difficulty: 2 · Static-detectable: not applicable

## Eval design in detail

### What makes a fix case fair and repeatable

A case enters the suite only after five checks, all scripted.
1. The base passes every hidden test.
2. The plant makes the fail-to-pass tests fail 5 times out of 5.
3. Every best and acceptable solution in the corpus passes everything.
4. Every masks-symptom and wrong solution fails at least one discriminator. If no test can tell a wrong fix from a right one, the entry is ranked by fingerprint or judge, and the case says so.
5. A second reference fix in another style passes. Plan v2 already asks this of probes [V `research/plan-v2.md:54`].

The package for one case: `case.json` with id, class, cause codes, severity and the one-line cause, `REPORT.md`, `plant.patch`, `verify/` with both test sets, `solutions/*.patch` with a rank and a fingerprint each.

### Measuring performance on a shared machine

Wall-clock time on Slimbook is noise. Three rules.

**Count before you time.** Queries, round-trip waves, upstream hits, queued jobs, requests, bytes and chunks do not depend on load.

**When time is the point, inject the cost.** A fixed 80 ms per database call or a 2 s rates stub makes the planted cost many times the noise. Take the median of 3 runs. Set the budget at the geometric mean of the planted and the best value. Drop any timing check where the two are less than 5 times apart.

**Read the numbers from outside the app.** The verifier should not add endpoints to the agent's code.

| Metric | How to read it | Where the hook is |
| --- | --- | --- |
| Queries and waves per request | a libSQL server or proxy that logs and delays, behind `DATABASE_URL` | the reference takes "a SQLite file or a libSQL/Turso URL" [V `nuxt.config.ts`]. The proxy needs a spike [G]. Drop counts waves with a Drizzle `sqlite-proxy` inside unit tests [R]. |
| Same, with no proxy | ViteHub's `database` field on the request's wide event: `calls`, `ms`, `maxConcurrent` | [V `packages/database/src/runtime/request-stats.ts:4-11`]. It needs an evlog request logger, or it records nothing [V lines 38-44]. |
| Query plan | `EXPLAIN QUERY PLAN` on the logged SQL, no `SCAN <table>` | Drop's assertion [R] |
| Upstream calls | a stub server with a counter and a delay | `NUXT_RATES_URL` [V reference runtime config] |
| Mail | a stub provider endpoint that counts and can fail | production builds send through Resend [V `nuxt.config.ts`], so the stub stands in for its API [G on the base-URL override] |
| Payload and API bytes | fetch the built server, measure the `__NUXT_DATA__` script and the JSON | none needed |
| JS per route | the client manifest after `nuxt build` | none needed, one build per run |
| Requests per interaction | Playwright network log | none needed |
| Boot time | spawn to first 200 | none needed |
| Blocking | p95 of side requests during the slow one | none needed |
| Memory | `/proc/<pid>/status` with a small `--max-old-space-size` | none needed |

Bundle and Playwright checks need a build, about 2.5 GB each on Slimbook. Counting checks run against handlers and cost far less. Build the counting cases first.

### Matching a fix to the corpus

The hidden tests answer "does it work". The fingerprint answers "which fix is it" for most runs before a model reads anything.

- The SQL shape during the reproduction test separates the oversell fixes at once: one `INSERT ... SELECT ... WHERE count < capacity`, a `BEGIN IMMEDIATE` around a read and a write, or a read, a write and a retry.
- Counts separate cache fixes from query fixes: the same number of queries with a faster repeat is a cache.
- The dependency diff, new tables and new ViteHub config keys mark over-engineering.
- Whether the diff touches the planted lines marks masking. A fix that leaves the plant and adds code elsewhere is nearly always a mask.

The judge sees the diff, the corpus entries in shuffled order, and nothing about the agent. Run it twice. On disagreement, or on "novel", a person decides and the corpus grows by one entry. Track the novel rate per case. A case with many novel fixes has a corpus that is too thin.

### Scoring over-engineering

Footprint compares the run to the best fix on five counts: lines changed, files touched, new dependencies, new tables or migrations, new ViteHub packages or config keys. Tests the agent adds, the lockfile and generated migration snapshots do not count.

`ratio = max(lines / best_lines, files / best_files)`. The score is 1 up to 1.5, falls in a straight line to 0 at 6. Then subtract 0.3 for a new dependency no ranked solution has, 0.3 for a ViteHub package no best or acceptable solution uses, and 0.2 for edits in files unrelated to the cause. The floor is 0.

Two cases exist to test this number: P-04, where one line beats a correct streaming rewrite, and T-04, where 8 lines beat a currencies table.

### Keeping cases from leaking

- **Comments.** The reference explains every hardening choice in a comment [V, for example `rsvp.post.ts:15-17`]. Strip them from plants and from clean code alike.
- **The public copies.** The site publishes the reference in its Workspace, and Drop is a public repository. With web access on, the answer is one fetch away. Either turn web off for A and B, or serve a renamed private fixture and fail any run whose transcript fetched the site, the repository or the fix commit. The audit that reads each transcript already exists [V `README.md`, step 2].
- **Git.** One fresh commit per fixture. No history, no `.orig` files, no reflog.
- **Paths and names.** A neutral folder name, as the judge already uses [V `README.md`]. No case id anywhere the agent can read.
- **Visible tests.** Ship a normal test suite so running tests is realistic, and keep the fail-to-pass tests hidden.
- **Variants.** Generate each plant from a seed that picks the handler, the names and the seed data, so one leaked case does not solve the next.
- **Held-out set.** Split cases into a dev set, which skills may be tuned on, and a held-out set for the headline, as plan v2 does with projects [V `research/plan-v2.md:40`].
- **Skills.** No case name, file name or report phrase in any skill under test [V plan v2 U5].

### Additions for B

Grok's seat designed B in depth. I would add four things.
- The clean-base control, case B-01.
- Two plant densities on the same fixture, 6 and 18, to see whether recall falls as plants crowd.
- Severity order as a rank correlation over matched plants, so an agent that finds everything and ranks the N+1 above the data leak loses points.
- Recall split by what a linter can see. N-02 is the linter-visible tier and N-01 the blind one. The gap between them says whether the agent reads code or runs tools.

## The 20 I would build first

Chosen for a check that needs no model and little machine time, one case per cause where possible, every task type present, and a plant of 25 lines or fewer.

| # | Case | Why first |
| --- | --- | --- |
| 1 | N-01 mail error swallowed | 2-line plant, linter-blind, pure ViteHub, both A and B |
| 2 | P-05 cache stampede | a counter decides it, and three fixes rank cleanly |
| 3 | P-01 list payload | byte totals, and `transform` is a clean mask to catch |
| 4 | P-09 page waterfall | `lazy` passes the naive check, so it proves the discriminator idea |
| 5 | P-10 missing index | the fix needs a migration, which is where agents stop early |
| 6 | M-02 edited migration | real incident, fresh database hides it |
| 7 | P-11 reminder tick | counts only, real evidence from two apps |
| 8 | P-13 KV feed | tests "right store" and a lost update in one |
| 9 | P-04 CSV blocking | one line beats a rewrite, the footprint score's test |
| 10 | P-12 unbounded cache | the best fix is a deletion |
| 11 | P-06 polling storm | Realtime is the trap, the ViteHub knowledge check |
| 12 | P-07 covers | bytes, and a Blob feature agents do not know |
| 13 | N-03 build error | cheapest case, measures reading a diagnostic |
| 14 | N-04 not a bug | the control for "always writes a diff" |
| 15 | T-04 add a currency | the everyday request, and the time and token baseline |
| 16 | T-02 co-organizers | a matrix score with no judge |
| 17 | T-06 refactor mail | shows a refactor can be graded |
| 18 | T-07 tests by mutation | reuses every plant above |
| 19 | D-01 Drop round trips | the large app, with a real test already written |
| 20 | B-01 clean base | needed before any B precision number means anything |

Next: T-01, T-05, M-01, P-02, P-03, P-08, D-02, D-03, T-08, T-09, T-03, M-03, N-02, S-01, S-02.

## Open questions for Maxi

1. **Web access.** Plan v2 keeps the web open for every setup. For fix and hidden-bug evals that exposes the answer: the reference is on the site and Drop is public. Web off, or private renamed fixtures with an audit?
2. **Type C.** Are change tasks in scope now: a feature in an existing app, a refactor, tests, a review, a question? I think they are the other 95% you mean. They need no plants and reuse the hidden tests.
3. **"No change" as a right answer.** N-04 and T-09 score a run that edits nothing. Do you want controls like these in the headline, or reported apart?
4. **How vague is the report?** I wrote one level, a user's words with no file or cause. A second level with a log line would show how much the hint is worth. One level or two?
5. **What may the agent run?** In A it should run the app and the tests. In B, "static" forbids running the app. Does it also forbid Vite Doctor and `tsc`?
6. **Cost in the headline?** I kept time and cost beside quality and added cost per accepted fix. Findings v6 option 3 points the same way.
7. **Which ViteHub commit?** The reference pins `1e807fc`, and main has renamed `runQueue` to `sendQueue`. An agent that reads today's docs writes code that fails on the pin. Keep the pin and accept that, or move the base to main and re-grade the reference?
8. **A Cloudflare base.** The host-limit bugs in W12 and most multi-isolate races cannot be reproduced on Node with SQLite. Is a workerd variant of the base worth its cost in the first round?
9. **"Vue portal".** I found no issue or commit with that name: `gh search issues --repo vite-hub/vitehub portal` returns nothing, and "portal" in ViteHub's log is the Console's page tools. My candidates, formed before I read the others: the Auth performance series of 2026-11-10 to 11-12, PR #4001 "build Better Auth once per resolved options and read the session once per request" and PR #4044 "stop preloading the Auth client and reading the session on pages that do not use Auth" [R], and PR #2692 "createAuthClient loads Better Auth's Vue client on first use" [R], which Drop adopted in `f949cdb7`. Grok's P07 and Sol's SOL-11 and SOL-12 already build cases on these. Is one of them what you meant?
10. **The reference as a clean base.** S-02 may be a real weakness in it. Do you want a three-reviewer pass over the stripped base before any plant goes in, as grok's seat proposes?
11. **Skills.** The brief says no skills for A. The repository's question is whether tooling helps, so the same cases with setups B and C would answer it for fixes too. Later round?

## Evidence and verified APIs

ViteHub at `1e807fc` unless marked main.

| API or fact | Where |
| --- | --- |
| `db`, `schema`, `useDatabase` | `packages/database/src/drizzle.ts:42,44,56` |
| `defineDatabase` | `packages/database/src/definition.ts:22` |
| Per-request database stats `calls`, `ms`, `maxConcurrent` | `packages/database/src/runtime/request-stats.ts:4-11,38-44` |
| `runQueue`, `deferQueue`, `getQueue` | `packages/queue/src/index.ts:8`, `runtime/client.ts:161` |
| `defineQueue` | `packages/queue/src/definition.ts:4` |
| Local queue: 4 attempts, retries after 1, 2 and 4 s | `packages/queue/src/providers/local.ts:155` |
| `idempotencyKey` holds while a job is pending or running; Cloudflare rejects it | `docs/content/docs/queue/server-api.md:159,161` |
| main: `sendQueue`, `useQueue`, no `runQueue` | `origin/main:packages/queue/src/index.ts:3` |
| main: codemods, including `nuxthub` and `queue-workflow-verbs` | `origin/main:packages/codemods/src/registry.ts`, `docs/content/docs/codemods/index.md` |
| `requireRateLimit`, `checkRateLimit` | `packages/rate-limit/src/guard.ts:135,139` |
| `createRateLimiter`, `memoryRateLimitDriver` | `packages/rate-limit/src/limiter.ts:234`, `drivers/memory.ts:23` |
| `ensureBlob`, `detectContentType` | `packages/blob/src/ensure.ts:15`, `content-type.ts:24` |
| Blob `put`, `head`, `list`, `addRandomSuffix` | `packages/blob/src/types.ts:57,140-142` |
| Blob image variants and `srcset` | `packages/blob/src/media/variant.ts:44`, `responsive.ts:113-123` |
| `kv` | `packages/kv/src/index.ts:1`, `runtime/storage.ts:143` |
| `defineSchedule` | `packages/schedule/src/definition.ts:36-38` |
| Node needs the process driver, `VITE_HUB_R0137` | `packages/vite-hub/src/index.ts:653`, `docs/content/docs/schedule/hosts.md:28-30` |
| `email`, `renderEmailMarkdown` | `packages/email/src/runtime/email.ts:11`, `markdown.ts:13` |
| Dev outbox, `remote: true` | `docs/content/docs/email/get-started.md:51` |
| `defineAuth`, `authDatabase` | `packages/auth/src/definition.ts:136`, `database.ts:22` |
| `withAuth`, `withAuthorization`, `requireAuth`, `requireAuthorization` | `packages/auth/src/server.ts:782,801,836,846` |
| Plugin tables belong in the Database Definition; `AUTH_C0056` | `docs/content/docs/auth/configure.md:221,225` |
| `defineWorkflow`, `runWorkflow`, `getWorkflowRun` | `packages/workflow/src/definition.ts:4`, `runtime/client.ts:165,185` |
| `defineRealtime`; Realtime is not a general WebSocket API | `packages/realtime/src/definition.ts:3`, `README.md:12` |
| `env` | `packages/env/src/core/declarations.ts:257` |
| main: Doctor rules VHUB0003, 0006, 0008, 0009, 0017, 0033 | `origin/main:docs/content/docs/reference/doctor-rules.md` |

Real commits and PRs I read. Drop: `a4996961`, `82f67277`, `6b331bbd`, `57be0e1f`, `f949cdb7`, `5c86a12a`, `3253db64`, `1892ddcc`, `126800fd`, `3da7a6cf`, `0b2c2d7d`, `983468e5`, `1c72b513`, `1e14bda4`, `db185059`, `d673ddc8`. I read the full diff of `a4996961` only in part, and the message and stat of the rest. email-labeller: `991e3a0`, `8882c29`, `6efc348`, `552e464`. babysitter: `94cf746a1`, `70a0c2fde`, `164146e12`, `6e25c2444`. ViteHub PRs #4001 (full body), #4044, #2692, #2694, #2519 (titles and state). nuxt-evals: `38f825d`.

Sizes I measured: Drop is 50,629 tracked lines without lockfile and media, 382 app, server and shared files, 51 test files. The Meetups reference is 2,881 lines. `vite-hub/drop` is public and `vite-hub/nuxt-evals` is private, from `gh repo view`.

Not checked, and worth a look before building: Nitro's one-pending-call behaviour in `defineCachedFunction` (P-05), header precedence between route rules and Blob serve (P-08), how Better Auth 1.7 schedules `sendResetPassword` (S-01), any body-size cap in h3 v2 or ViteHub (S-02), whether the published codemods run on a pkg.pr.new pin (M-01), and every byte and millisecond budget tagged [G]. The rubric fail rates over 15 runs are in `council-grok.md`. I did not recount them.
