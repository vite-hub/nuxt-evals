# Fix and hidden-bug evals: corpus (council member: Claude Opus)

Research only, 2026-11-14. Lens: ViteHub's own history and the ViteHub apps.

**How to read the sources**
- **ViteHub paths** are on `origin/main` of `/home/maxi/vitehub/vitehub` (99a876c7d2, 2026-11-14), read with `git show` and `git grep`. The local checkout is an October branch.
- **Commit SHAs.** Every SHA was checked by me with `git log -1` (it exists and the subject matches).
- **Before/after code.** For app-repo commits, it comes from three mining subagents that read the diffs. I read these diffs myself: drop `b772236e`, email-labeller `b2b6f33`, and the ViteHub doc and API lines cited with `path:line`.
- **"Guess"** marks anything I did not check.

**Fixture names**
- **M** is the Meetups reference, `tasks/meetups/reference`: 2,322 lines of TS/Vue, graded 10. It pins ViteHub `1e807fc9` (2026-11-08), which is 671 commits behind `origin/main`. It still uses `runQueue`, which #3714 renamed to `sendQueue` on 2026-11-10.
- **J** is a new jobs fixture, about 800 lines, to build: webhook intake → Queue → Workflow → KV/DB job state → Email, plus a Schedule sweeper. It is modelled on strata, email-labeller and babysitter, because M has no Workflow, Realtime or Agent.
- **L** is "Meetups-legacy": M written on Nuxt 3-era code, NuxtHub v0.10 and h3 v1 (synthetic). Its migration target is M, so M is the best solution and its rubric already exists.
- **S** is a small fixture cut from one real repo.

## Scoring and fixture strategy

**A (fix).** Gate first: the hidden symptom test, M's regression probes and the build. A failed gate scores 0 and records why. Then:

| Dimension | Weight | Graded by |
| --- | --- | --- |
| Root cause | 25% | Judge, 0–3: none / symptom / cause without mechanism / exact |
| Solution class | 25% | best 1, acceptable 0.7, over-engineered 0.4, masks 0.1, wrong 0; novel → human queue → corpus |
| Primitive use | 15% | Static probe for the best fix's API (`chunkParameters`, `setIfAbsent`, `blob.serve`…) or a stated reason not to |
| Regressions | 15% | Hidden probes on the other features |
| Minimality | 10% | Diff size against the best fix, unrelated edits, new dependencies |
| Verification | 10% | The agent's test fails on the pristine fixture and passes on its fix |

Time, tokens, cost and "turns until the planted file was opened" sit beside the score, not in it (findings-v6, option 3).

**B (hidden).** Recall weighted by severity 40%, precision 25% (a real unplanted bug is neutral and joins the list; a false positive costs), severity order 15% (Kendall τ), explanation 20% (lines, mechanism, trigger). Match by file, a ±10-line window and a class tag; the judge settles only ties. Don't give the bug count.

**Matching a fix.** Hidden tests first: they separate fixed, masked and broken, and each mask has a probe built for it (a two-process run catches an in-memory lock). Then the judge picks the nearest ranked solution and quotes diff lines; the CLI maps the class to points. A case enters the set only when patches of its best, masking and wrong fixes rank correctly in 3 reruns (plan-v2's rule).

**Fixtures.** Reuse M for about 60% of A cases: it scores 10, seeds data, uses nine primitives, and its comments name the bug each choice avoids (see "M as an oracle"). Strip those comments, and plant one bug per run in a fresh copy. Build J for job-state nooks and L for migrations. Skip one huge app: search cost swamps fix quality. Use size only in B (M plus J, 8–10 plants, about 3.5k lines). Pin ViteHub per fixture: most fixes here landed after M's pin, which decides whether a bug lives in the primitive or in app code.

## Why these bugs get written (the patterns behind the cases)

1. **Dev hides production.** Local providers lack the production limits and failure modes:
   - the local queue has no payload limit;
   - the inline workflow does not replay steps;
   - fs-lite ignored TTL until `ae217627b4`;
   - libSQL has no 100-parameter limit;
   - one process makes an in-memory lock look correct.

   The bug appears only on Cloudflare, with two instances, or on a retry.
2. **Result tuples instead of throws.** `email.send`, `kv.*`, `blob.*` and `sendQueue` return `[error, value]`. An `await` with no destructure looks like it works, and a tuple is always truthy.
3. **Names that read like guarantees:** `authorize: true`, `put({ access: 'private' })`, `sendQueue(…, { id })`, `cron`, `defineCachedEventHandler`. Each sounds safer than it is.
4. **SSR doubles the call graph.** In-process `$fetch` re-reads the session, and per-component `useFetch` multiplies calls on the server.
5. **Jobs and schedules have no request,** so authors cache "the" origin or read it from Host.
6. **Read-then-write across an `await`.** Every `await` yields, so check-then-act races even on one Node process. D1 has no interactive transactions to hide it in.

---

## Cases

### QW1 Job swallows a failed send
- Type: both · Class: nook · Primitive(s): Queue, Email
- Fixture: M, `server/utils/mail.ts` `sendRsvpMail`. Replace `const [error] = await email.send(…)` and its release-and-rethrow branch with a bare `await email.send(…)`. 1–6 lines.
- Report: "A few people say they never got the 'you're going' email. The queue page shows nothing failed."
- Root cause: `email.send()` returns `[error, data]` and does not throw. The handler resolves, the queue acknowledges the job, and the sent-at claim stays set, so no retry ever sends.
- Why it gets written: every other Promise API throws. The queue docs say "When a handler throws … the provider retries" (`docs/content/docs/queue/limits-and-errors.md:59`), so authors assume errors propagate. Tuples arrived in `2ea9501659` (#2579).
- Verification: `setupViteHubTest()` (`packages/vite-hub/src/test.ts:63`) with a mail driver that fails the first send. The handler must reject; after the retry, `hub.emails.length === 1` (`test.ts:38`). Static check: Doctor VHUB0003, `vitehub/destructure-result-tuples` (`docs/content/docs/reference/doctor-rules.md:152`).
- Solutions:
  - [best] Read the tuple, release the claim, rethrow. This is M's own code: the retry works and the claim stays honest.
  - [acceptable] Mark sent only after a successful send. Retries work, but a crash between send and mark sends twice (see QW2).
  - [over-engineered] A Workflow step for one send. It adds a primitive and steps still repeat.
  - [masks-symptom] `try/catch` plus a log. The loss is logged and the mail is still lost.
  - [wrong] Throw without releasing the claim. The retry sees the claim and returns: the same loss, now with an error line.
- Agent traps: fixes the throw and forgets the claim; blames the Resend config; adds queue retries that never run.
- Evidence: real, `2ea9501659` (#2579) and the Doctor rule in `49f1002aaa` (#3168). M's `mail.ts` is the best fix.
- Difficulty: 2 · Static-detectable: yes

### QW2 Retried job sends the email again
- Type: A · Class: nook · Primitive(s): Queue, Email, Database
- Fixture: M, `sendRsvpMail`. Remove the conditional `update … where sent is null returning` claim; send first, then set `confirmationSentAt`. About 10 lines.
- Report: "Some attendees got the confirmation three or four times."
- Root cause: delivery is at least once, and the handler sends before it records. A failure after the send, or a restart before the ack, sends again on each of the 4 attempts.
- Why it gets written: in dev each job runs once and succeeds. The rule lives only on the limits pages: "Delivery is at least once … Make side effects safe to repeat" (`queue/limits-and-errors.md:203`), and `frameworks-hosts/production.md:63-68`.
- Verification: a test makes the step after the send throw once, then runs 2 attempts and expects 1 email in `hub.emails`. Two parallel jobs for one RSVP also give 1 email.
- Solutions:
  - [best] Claim the sent-at column in one conditional UPDATE…RETURNING before sending, and release it on a provider error (M). Atomic on every provider.
  - [acceptable] A unique `sent_emails(kind, rsvp_id)` row inserted before the send.
  - [acceptable] `email.send({ …, idempotencyKey })` (`packages/email/src/types.ts:51`). Resend only: the Cloudflare driver rejects it (`packages/email/src/drivers/cloudflare-email.ts:130`).
  - [over-engineered] A Workflow with a send step. Steps repeat too (`workflows/get-started.md:104`).
  - [masks-symptom] Turn retries off. Mail is lost instead.
  - [wrong] A KV `get`/`set` "sent" flag, which is racy (`kv/server-api.md:129`).
- Agent traps: adds `idempotencyKey` to `sendQueue`. That dedupes pending jobs only, not attempts of one job (`queue/limits-and-errors.md:204`).
- Evidence: M's design. babysitter `2208a8287` and `1a773f605` are the same class (a redelivery re-ran a paid pass).
- Difficulty: 3 · Static-detectable: partly

### QW3 Reminders arrive twice
- Type: A · Class: nook · Primitive(s): Schedule, Queue, Database
- Fixture: M, `server/schedules/event-reminders.ts`. Send inline in the loop, with no job and no per-RSVP claim, and set `reminderSentAt` after the loop. About 15 lines. Variant b: keep M's code, add a non-idempotent "notify organizer" webhook job, and run two replicas on one `.vitehub/data` volume.
- Report: "People get the 'tomorrow' reminder twice, sometimes more. It started when we added a second server." Variant: "…after a deploy".
- Root cause: one occurrence can run more than once (two instances without a Database lease, catch-up after a restart, a host double wake, a manual run), and the handler is not idempotent per RSVP. In variant b, the local queue has no lock between processes.
- Why it gets written: people think "cron fires once". The docs say otherwise: "A host can deliver one cron wake twice" (`schedule/configure.md:241`); "Without a Database … each server runs every occurrence" (`:118`); and for the queue, "Run one server process per folder" (`queue/limits-and-errors.md:209-210`). Once-per-occurrence across instances came in `2b08764c78` (#3861), after M's pin.
- Verification: `hub.runSchedule(def, { scheduledAt })` (`test.ts:52`) twice with the same time, plus two runs in parallel: one email per due RSVP. Variant b: two processes, 20 jobs, the webhook mock counts 20. On `main`, booting with `VITEHUB_INSTANCES=2` fails with `RUNTIME_R0017` (`6908003fb1`).
- Solutions:
  - [best] Claim per RSVP (conditional update of `reminderSentAt`) inside a job queued with `idempotencyKey: event-reminder:<id>` (M). Safe under any repeat.
  - [acceptable] Keep the inline send, but claim each RSVP before sending. No retries, and a slower tick.
  - [acceptable] Variant b: the postgres queue provider, picked automatically with a Postgres Database (`6cc355d4a3`, #3865), or one process.
  - [over-engineered] A KV or DB lock on the whole tick. It still repeats on catch-up.
  - [masks-symptom] Run one instance, or drop `manual: true`.
  - [wrong] `sendQueue(…, { id })` to dedupe. It was ignored before `a7e0b8e916` (#4248) and is rejected after it.
- Agent traps: locks the tick instead of the RSVP; uses a KV flag; trusts the run's `idempotencyKey` (`packages/schedule/src/types.ts:11`), which Vercel, Netlify and Deno estimate (subagent: `schedule/configure.md:255`).
- Evidence: real, `2b08764c78` (#3861), `5aee505fd6` (#2453, catch-up), `6908003fb1` (#3908); M is the best fix.
- Difficulty: 3 · Static-detectable: partly

### QW4 Two clicks start two analyses
- Type: A · Class: nook · Primitive(s): Workflow, Database, Email
- Fixture: J, `server/api/analyses.post.ts`. It calls `startWorkflow('analyze', { repo, sha })` with no id; step `01.create-report` does a plain insert and step `03.notify` sends mail. About 30 lines.
- Report: "If I click Analyze twice I get two reports and two emails. Once it happened with one click."
- Root cause: no run id, so each POST starts a run. The steps are not idempotent, so a durable provider's replay repeats them. The inline dev provider never replays, so dev hides this (`workflows/get-started.md:104-106`).
- Why it gets written: the dev provider makes non-idempotent steps look correct, and "start a workflow" reads like "enqueue once".
- Verification: two POSTs with the same repo and sha leave `hub.workflows.length === 1` (`test.ts:42`). Running a step twice gives 1 row and 1 email.
- Solutions:
  - [best] `startWorkflow(name, payload, { id: \`analyze:${repo}@${sha}\` })` (`packages/workflow/src/runtime/client.ts:167`, `types.ts:146`; inline dedupe since `ab096f3c8e` #2734), plus an upsert in the step.
  - [acceptable] A unique index with `onConflictDoNothing` in the step and no run id. Rows dedupe, but two runs still send two emails unless the mail is keyed.
  - [over-engineered] A Queue with concurrency 1 in front of the workflow.
  - [masks-symptom] Disable the button.
  - [wrong] A KV `get`/`set` flag.
- Agent traps: a stable id on Vercel native workflows, which reject an `id` (`workflows/server-api.md:37`); dedupes on the button only.
- Evidence: real, `ab096f3c8e` (#2734); the step-safety docs line.
- Difficulty: 3 · Static-detectable: partly

### QW5 Thumbnails never appear on Cloudflare
- Type: both · Class: nook · Primitive(s): Queue, Blob
- Fixture: M, `cover.put.ts`. Add a `make-thumbnails` job whose payload carries the base64 image. About 20 lines. Verify with `host: 'cloudflare'`.
- Report: "Cover upload works on my laptop, but on the Cloudflare deploy the thumbnail never shows up."
- Root cause: the payload is over Cloudflare Queues' 128 KB of JSON. Local and postgres have no limit (`queue/limits-and-errors.md:234`).
- Why it gets written: local delivery accepts anything. Only `f6467591bc` (#3440, 2026-11-06) made dev apply the build host's limits.
- Verification: a spy on `sendQueue` sees a payload under 1 KB. Vite dev with `host: 'cloudflare'` returns `QUEUE_PROVIDER_FAILED` before the fix.
- Solutions:
  - [best] `blob.put` first, then enqueue the pathname.
  - [acceptable] Drop the job and resize on the serve route. M already does this with `?w=`.
  - [over-engineered] Split the payload across several messages.
  - [masks-symptom] Compress the base64. It still fails on bigger photos.
  - [wrong] Look for a limit setting. None exists.
- Agent traps: fixes the thumbnail code; never connects the symptom to the host.
- Evidence: real, `f6467591bc` (#3440); the limits table.
- Difficulty: 2 · Static-detectable: yes

### QW6 One bad message stops the whole inbox
- Type: A · Class: bug · Primitive(s): Schedule, KV (or Queue)
- Fixture: J, a cursor-based batch processor (`server/lib/sync.ts`) that calls `await Promise.all(items.map(process))` and advances the cursor only after all succeed. One seeded item always throws. About 40 lines.
- Report: "Labelling stopped hours ago, but /api/health says ok."
- Root cause: a poison message fails the batch on every run, so the cursor never advances. Health only checks that the process is up.
- Why it gets written: "advance only after everything succeeds" is correct until one item can never succeed. Nothing dead-letters it.
- Verification: seed 10 items with #3 poisoned. After N runs, the other 9 are processed, #3 is listed as skipped, and health is non-200 while syncs fail.
- Solutions:
  - [best] `Promise.allSettled`, a per-item attempt count, skip after 3 and report it, and health that turns 503 after 2 failed syncs. This is the real fix.
  - [acceptable] One Queue job per item. Failed jobs become dead jobs after 4 attempts (`queue/limits-and-errors.md:201`).
  - [over-engineered] A separate retry service or table with backoff tiers.
  - [masks-symptom] `try/catch` that drops the item silently.
  - [wrong] Advance the cursor before processing. Items are lost on a crash.
- Agent traps: fixes only the 100 KB item; keeps health green.
- Evidence: real, email-labeller `6efc348`.
- Difficulty: 3 · Static-detectable: partly

### QW7 A module-level lock that doesn't lock
- Type: both · Class: bug · Primitive(s): Database, Schedule
- Fixture: J, `sync()` guarded by `let running: Promise | undefined`. Both a webhook route and a `defineSchedule` call it. About 30 lines.
- Report: "Some emails get labelled twice, others never."
- Root cause: module state is per process or isolate. Two processes, or two Worker isolates, run `sync()` at once, process the same history twice and race the cursor.
- Why it gets written: in-memory locks work in dev and on one Node process.
- Verification: two app processes on one SQLite file and 10 concurrent triggers: each message is processed once. A one-process test would pass the masking fix, so the test must use two processes.
- Solutions:
  - [best] A DB lease: `update … set leaseUntil where leaseUntil is null or < now returning`; release only if still held; re-check requests that arrived meanwhile (email-labeller `2ddf40e`; joxi `9f1bd85` `reserveSync`).
  - [acceptable] `kv.setIfAbsent(key, owner, { ttl })` (`packages/kv/src/types.ts:12-16`). Atomic on database, redis, upstash and fs-lite; unsupported on Cloudflare KV (`kv/server-api.md:131-140`).
  - [acceptable] A Queue with concurrency 1, but only on a host where that holds across instances. With the postgres provider it is per process (`queue/limits-and-errors.md:219`), and the local provider has no lock between processes (`:209-210`).
  - [over-engineered] A Durable Object or an external lock service.
  - [wrong] A KV `get`-then-`set` lock.
- Agent traps: makes the mutex fancier; adds `await` ordering.
- Evidence: real, email-labeller `2ddf40e`; joxi `9f1bd85` (double-click sync).
- Difficulty: 3 · Static-detectable: yes

### QW8 "Cloning…" for an hour
- Type: A · Class: bug · Primitive(s): Queue, Workflow, KV
- Fixture: J. A job record set to `processing` when the work starts; the worker is killed in the test.
- Report: "The page has said 'Cloning…' for an hour."
- Root cause: no lease or heartbeat. A dead worker leaves the record in a non-terminal state forever.
- Why it gets written: the docs promise retries, so authors assume the work always finishes or fails.
- Verification: a record with `updatedAt = now − ttl − 1s` becomes `failed` (or is retried), and a fresh one stays `processing`.
- Solutions:
  - [best] A Schedule sweeper, or a workflow failure handler, that fails or requeues stale records.
  - [acceptable] A staleness check on read that marks it failed (strata `2481a63`).
  - [over-engineered] A heartbeat table with a separate watchdog process.
  - [masks-symptom] A longer client timeout or a spinner message.
  - [wrong] Delete the record.
- Agent traps: fixes only the UI.
- Evidence: real, strata `2481a63`.
- Difficulty: 2 · Static-detectable: partly

### QW9 A finished job goes back to the spinner
- Type: both · Class: bug · Primitive(s): KV, Queue, Workflow
- Fixture: J, `updateJob(id, patch)` as `kv.get`, then spread the patch, then `kv.set`. A fake workflow posts `completed`, then a late `processing`. About 25 lines.
- Report: "It finished, then the page went back to the spinner forever."
- Root cause: unordered read-modify-write with no terminal state. A late progress patch overwrites `completed`.
- Why it gets written: `kv.get`/`kv.set` reads like a row update, and callbacks from Queue, Workflow and Sandbox arrive in any order.
- Verification: complete, then a late progress update: GET still returns `completed`, over 100 random orderings.
- Solutions:
  - [best] Monotonic status in the Database: `update … where status not in ('completed','failed')`.
  - [acceptable] A guard in `updateJob` that keeps `completed` (strata `9c3536d`).
  - [acceptable] A version compare-and-swap.
  - [over-engineered] Move job state into a Durable Object (strata's follow-up `72ca27c`; right on Cloudflare at scale, heavy for one record).
  - [masks-symptom] Repair `result && status !== 'completed'` on GET.
  - [wrong] Debounce the progress updates.
- Agent traps: adds sleeps; reorders the calls in the workflow.
- Evidence: real, strata `9c3536d` and `72ca27c`.
- Difficulty: 3 · Static-detectable: yes

### QW10 Result page errors when email breaks, and sends duplicates
- Type: both · Class: bug · Primitive(s): Email, Workflow
- Fixture: J. `GET /api/analyses/:id` calls `await sendNotificationIfNeeded(job)`, which reads a `notified` flag, sends, then sets it.
- Report: "The result page shows an error whenever email is misconfigured. People also got the 'done' email several times."
- Root cause: a side effect on a read path. A mail failure becomes a 500, and concurrent GETs race the flag.
- Why it gets written: "notify when someone first sees it's done" puts the side effect wherever completion is noticed.
- Verification: with a throwing mail driver, GET returns 200; 5 concurrent GETs send 1 email.
- Solutions:
  - [best] Send from the workflow's completion step, or a job, with a claim (conditional update of `notifiedAt`).
  - [acceptable] Keep it in GET, but claim atomically and send after the response (`waitUntil`).
  - [over-engineered] An outbox table with a dispatcher.
  - [masks-symptom] `try/catch` around the send. This was the real commit's fix; duplicates stay.
  - [wrong] Cache the GET.
- Agent traps: copies the real commit (`try/catch`). This case checks whether an agent beats the historical fix.
- Evidence: real, strata `78a28f4`. Ranking that fix as masks-symptom is my judgment.
- Difficulty: 3 · Static-detectable: yes

### QW11 The disk fills with copies of the same webhook
- Type: A · Class: perf · Primitive(s): Database, Schedule (Agent webhook intake in the original)
- Fixture: J. A webhook route plus a 15-minute reconcile poller store `deliveries(id PK, payload)`; the poller's synthetic id is `sha256(JSON.stringify(payload))`, and the payload embeds `updated_at`. About 30 lines.
- Report: "The database grows by gigabytes a day and /api/health times out."
- Root cause: the dedupe key hashes volatile fields, so each poll stores every item again.
- Why it gets written: "hash the payload" is the reflex for a dedupe key.
- Verification: poll twice with unchanged data; the row count stays the same. Change `updated_at` only; the row count still stays the same.
- Solutions:
  - [best] A key over stable identity fields (`number` and `head.sha`), or the upstream delivery id (babysitter `d374d9ddd`).
  - [acceptable] A stable canonical JSON with `*_at`/`url` keys dropped and keys sorted (babysitter `1a773f605`).
  - [over-engineered] A content-addressed store with dedupe on read.
  - [masks-symptom] TTL cleanup of old rows.
  - [wrong] `INSERT OR REPLACE`. The writes and work remain.
- Agent traps: adds a cleanup job and calls it done.
- Evidence: real, babysitter `d374d9ddd` (27k rows/hour, 18 GB), `2208a8287`, `1a773f605`.
- Difficulty: 3 · Static-detectable: partly

### BL1 Anyone can open anyone's ticket
- Type: both · Class: security · Primitive(s): Blob, Auth
- Fixture: M at its pin. Add a ticket PDF per RSVP: `blob.put(\`tickets/${rsvpId}.pdf\`, pdf, { access: 'private' })` in the store that `/images` serves. About 25 lines.
- Report: "A guest says changing the number in their ticket link opens other people's tickets."
- Root cause: the served store is public. Before `617e7da84f` (#4289), `put({ access: 'private' })` changed nothing on fs, R2, S3 and the other drivers. `serve.authorize: true` alone only checks that someone is signed in.
- Why it gets written: `access: 'private'` and `authorize: true` read like per-object protection. The docs: "each request needs a signed-in Auth session" (`blob/configure.md:80`), and per-object checks belong to an `authorize` export (`:179`).
- Verification: user A's GET of B's ticket returns 403/404, A's own returns 200, anonymous returns 401. On `main`, the planted `put` throws `BLOB_R0045` (`packages/blob/src/error-diagnostics.ts:121`).
- Solutions:
  - [best] Keep tickets outside the served prefix or store. An app route does `requireUser`, checks `rsvp.userId === user.id`, then `blob.serve(event.req, path, { download: true })` (`packages/blob/src/types.ts:242`).
  - [acceptable] `serve: { authorize: true }` plus an `authorize` export in `server/blob.ts` that checks ownership (`BlobServeAuthorize`, `types.ts:608`).
  - [over-engineered] Short-lived signed URLs and one store per user.
  - [masks-symptom] Unguessable names (`addRandomSuffix`). Still public once leaked.
  - [wrong] `authorize: true` with no ownership check.
- Agent traps: `authorize: true` and done; random names.
- Evidence: real, `617e7da84f` (#4289); drop `76e65180` (a grant must re-check access: a revoked teammate kept reading).
- Difficulty: 3 · Static-detectable: yes

### BL2 An uploaded SVG runs script
- Type: both · Class: security · Primitive(s): Blob
- Fixture: M. Allow `image/svg+xml` in `COVER_TYPES`, drop the `detectContentType` check, and serve covers from a hand-written `server/routes/covers/[...path].get.ts` that returns `new Response(file, { headers: { 'content-type': file.type } })`. About 20 lines.
- Report (a security researcher): "I uploaded an SVG as an event cover and it ran JavaScript on your domain."
- Root cause: the route replays the uploader's content type on the app origin, with no sandbox. `blob.serve()` adds `Content-Security-Policy: sandbox` and `nosniff` for HTML, SVG, XML and multipart (`c62c0d2082`, #3998; listed in `getting-started/migrate-from-nuxthub.md`).
- Why it gets written: `blob.get()` returns a Blob, which invites a hand-made Response, and SVG is "an image".
- Verification: upload an SVG with `<script>`, then GET it. Expect `Content-Security-Policy` containing `sandbox`, or `attachment`, or a 400 at upload.
- Solutions:
  - [best] Serve with `blob.serve()` or the built-in route, and allow only raster types checked by byte sniffing (M's `ensureBlob` plus `detectContentType`).
  - [acceptable] Keep the route, and add `Content-Disposition: attachment` with a CSP sandbox.
  - [acceptable] A separate file origin through `publicBaseUrl`.
  - [masks-symptom] Strip `<script>` from SVGs. Sanitizer bypasses exist.
  - [wrong] Check the file extension.
- Agent traps: writes an SVG sanitizer.
- Evidence: real, `c62c0d2082` (#3998).
- Difficulty: 2 · Static-detectable: yes

### BL3 The recording won't seek
- Type: A · Class: bug · Primitive(s): Blob
- Fixture: M. Add an event recording upload, and serve it from `server/api/events/[slug]/recording.get.ts` as `new Response((await blob.get(p))[1].stream())`. About 15 lines.
- Report: "The recording stops halfway in Firefox and never plays on my iPhone."
- Root cause: no `Range` support (no 206, no 416). Safari needs ranges, and Firefox needs them to resume.
- Why it gets written: `blob.get` is the obvious API, and Chrome tolerates the missing ranges.
- Verification: `Range: bytes=100-199` returns 206 with `Content-Range` and a 100-byte body; `bytes=N-` returns 416.
- Solutions:
  - [best] `return blob.serve(event.req, path, { cacheControl })`. It streams and honours `Range` and `If-None-Match` (`packages/blob/src/storage.ts:20,357-361`; drop `4661d2cd`).
  - [acceptable] A hand-written 206/416 parser (drop `253dddd1`, the first fix).
  - [over-engineered] Transcode to HLS.
  - [masks-symptom] `preload="auto"`, or download the whole file first.
  - [wrong] Send `Accept-Ranges: bytes` without honouring ranges.
- Agent traps: blames the codec.
- Evidence: real, drop `253dddd1` then `4661d2cd`.
- Difficulty: 2 · Static-detectable: partly

### BL4 A big upload takes the server down
- Type: both · Class: security · Primitive(s): Blob
- Fixture: M, `cover.put.ts`. Check `Content-Length` against the limit, then `await event.req.arrayBuffer()`. About 6 lines.
- Report: "The server restarted twice today while someone was uploading a cover."
- Root cause: a chunked body has no `Content-Length`, so the header check passes and the whole body is buffered.
- Why it gets written: the header check looks complete.
- Verification: a 50 MB chunked body with no length returns 413, and reading stops near the limit.
- Solutions:
  - [best] `blob.handleUpload(event, { multiple: false, ensure: { maxSize, types } })`. It checks before buffering since `58e55cf29b` (#4215); `ensure` is at `packages/blob/src/types.ts:170`.
  - [acceptable] h3 `assertBodySize(event, limit)` before reading (h3 `src/utils/body.ts:213`, checked on GitHub; drop `3253db64`).
  - [over-engineered] A streaming parser with manual byte counting.
  - [masks-symptom] A reverse-proxy body limit only.
  - [wrong] Check `Content-Length` again after reading.
- Agent traps: lowers the limit.
- Evidence: real, drop `3253db64`; ViteHub `58e55cf29b`. Guess, to check: M's own `cover.put.ts` calls `event.req.formData()` before `ensureBlob`, which may buffer the whole body. Fix M first if so.
- Difficulty: 3 · Static-detectable: yes

### BL5 The new cover never shows
- Type: both · Class: bug · Primitive(s): Blob
- Fixture: M, `cover.put.ts`. Remove `addRandomSuffix: true`, so the path `covers/<id>/cover` is reused, and keep the `immutable` one-year `Cache-Control` on `/images`. 1 line.
- Report: "I changed my event's cover photo and everyone still sees the old one."
- Root cause: an immutable, year-long cache on a pathname that is reused.
- Why it gets written: the cache header and the upload path live in different files. "Immutable" is right only for unique paths, as M's comment in `nuxt.config.ts` says.
- Verification: upload A, GET it, upload B. The page HTML references a URL whose bytes are B's, and no URL ever served changes content.
- Solutions:
  - [best] A unique path per upload and deleting the old one (M).
  - [acceptable] A version in the URL (`?v=<updatedAt>`).
  - [acceptable] `private, no-cache` with ETag revalidation (drop `82f67277`). One request per view.
  - [over-engineered] Purge the CDN on upload.
  - [masks-symptom] `no-store`. Every view downloads again (drop `82f67277` fixed exactly this).
  - [wrong] Tell users to hard-refresh.
- Agent traps: `no-store`; removes the cache header.
- Evidence: M's design; drop `82f67277`; Blob edge cache `99a876c7d2` (#4282) warns that nothing purges an edge copy (subagent: `blob/server-api.md:259`).
- Difficulty: 2 · Static-detectable: partly

### AU1 Pages are slow only when signed in (best match for the "Vue portal" issue)
- Type: A · Class: perf · Primitive(s): Auth (Nuxt data fetching)
- Fixture: M. Replace `useAuth()`'s `useState` and `callOnce` plugin with `useMe()`, which is `useFetch('/api/me')`, called by the header and by each `EventCard` ("You're going" badge). About 30 lines.
- Report: "The home page is fine logged out but takes seconds when I'm logged in."
- Root cause: during SSR each `useMe()` call starts its own request. Nuxt reuses payload data only while hydrating in the browser, and `dedupe: 'cancel'` restarts same-key requests. Each `/api/me` then reads the session again.
- Why it gets written: same key means one request on the client, so wrapping the session in a composable and calling it from leaf components looks free.
- Verification: count `/api/me` handler hits per SSR render; expect 1 (drop `test/auth/ssr-fetch-runtime.mjs` does this). Also count session reads: drop measured 94 calls per page. Guess: that it reproduces on M's Nuxt nightly; drop saw it on the October nightly.
- Solutions:
  - [best] One shared session state loaded once per request: `useState` plus `callOnce` in a plugin (M), or ViteHub's shared store (`useUserSession()`, one store per app since `47fc7f766d`, #4054, after M's pin). Return `going` per event from the list API.
  - [acceptable] A `createUseFetch` wrapper with `dedupe: 'defer'` and `getCachedData` that reads the payload on the initial cause (drop `b772236e`, read).
  - [over-engineered] A server-side LRU of sessions keyed by cookie. Revocation lags.
  - [masks-symptom] `server: false` or `lazy`. The N calls move to the browser.
  - [wrong] A module-level `ref` cache. It leaks across users (NX1).
- Agent traps: the module-level cache; `lazy: true`.
- Evidence: real, drop `b772236e` (94 `/api/me` calls). ViteHub `55fc3ffaa3` (#4044) removed a session read and the 30 KB client prefetch on pages that don't use Auth: signed-in `/` went from 1,186 to 7,319 req/s median, and CPU per request from 1,175 to 210 µs (PR body, read). `47fc7f766d` (#4054) is "Every component keeps its own copy of the session … Hydration sends a get-session request right after the server already read the session" (PR body, read). **"Vue portal":** no issue or commit mentions "portal" (searched `gh search issues/prs` and `git log --grep` in vitehub and all nine apps). #4054, a Vue and Nuxt session store with Capsa's behaviour, is the likely issue; #4044 is the one with the numbers.
- Difficulty: 3 · Static-detectable: partly

### AU2 Every request reads the session
- Type: A · Class: perf · Primitive(s): Auth, Database
- Fixture: M. Add `server/middleware/auth.ts`, which calls `auth.api.getSession({ headers })` for every request (including `/images/**` and public `/api/events`) and stores the user on `event.context`. Handlers still call `requireUser`. About 10 lines.
- Report: "Since we added the login check, the server's CPU has doubled and images load slower."
- Root cause: a session read on requests that don't need it, plus a second read in each guarded handler. In-process SSR fetches re-read it again.
- Why it gets written: one global middleware feels like the clean way to know the user everywhere. The docs show `useAuth(event).api.getSession(…)` (subagent: `auth/server-api.md:111`).
- Verification: count session reads per request, via a spy or `database.calls` on the request's wide event (`packages/database/src/runtime/request-stats.ts:43`). Expect 0 on `GET /api/events` and on images, and 1 on `GET /api/dashboard`.
- Solutions:
  - [best] Remove the global read: `requireUser` per route (M), with a memo on `event.context` for repeat calls.
  - [acceptable] Keep the middleware, but limit it to the guarded prefixes and memoize.
  - [acceptable] Better Auth's cookie cache, which trades revocation lag for fewer reads (Better Auth docs; not checked here).
  - [over-engineered] A cross-request LRU keyed by cookie.
  - [masks-symptom] Cache the public pages.
  - [wrong] `defineCachedEventHandler` on guarded routes (AU3).
- Agent traps: adds caching.
- Evidence: real, `2ebdec974c` (#4001: guards re-read the session and Better Auth was rebuilt per request; read); drop `d7ca11fb` (in-process API calls re-resolved the session, 3 of 5–7 D1 calls).
- Difficulty: 3 · Static-detectable: yes

### AU3 I saw someone else's RSVPs
- Type: both · Class: security · Primitive(s): Auth, Nitro cache
- Fixture: M. Add `server/api/me/rsvps.get.ts` wrapped in `defineCachedEventHandler(…, { maxAge: 60 })` "to speed up the header count", with `requireUser` inside. About 15 lines.
- Report: "My account page showed events I never signed up for."
- Root cause: the cache key is the path, so the first visitor's response is served to everyone for 60 s.
- Why it gets written: "cache the slow endpoint" is a reflex. ViteHub's build check (`AUTH_B0002`, `7ff101f2c7`) reads route rules for `access.routes` only. It does not read `definePageMeta({ auth })` (`auth/limits-and-errors.md:119`). Guess: it does not see a cached handler around `requireUser`, and M doesn't use `access.routes`.
- Verification: user A GETs, then user B GETs within 60 s: B gets only B's data.
- Solutions:
  - [best] A plain `defineEventHandler`. The query is one indexed select.
  - [acceptable] `defineCachedFunction` keyed by `user.id`, called after the auth check, and invalidated on RSVP.
  - [acceptable] `varies: ['cookie']`. Correct per user, but the cache fills with personal data.
  - [over-engineered] Client-side caching with a store.
  - [wrong] Lower `maxAge`.
- Agent traps: lowers the TTL; caches on the client.
- Evidence: real, `7ff101f2c7` (#3987); the docs lines above (read).
- Difficulty: 2 · Static-detectable: yes

### AU4 The admin export opens with a trailing slash
- Type: both · Class: security · Primitive(s): Auth, Nitro routing
- Fixture: M. Add `server/api/admin/export.get.ts` (all attendee emails) with no check of its own, and guard it in `server/middleware/admin.ts` with `if (event.url.pathname === '/api/admin/export') await requireAdmin(event)`. About 15 lines.
- Report: "Someone downloaded our full attendee list without an account."
- Root cause: the middleware compares the raw path, but Nitro routes after normalizing it. `/api/admin/export/` and `/api/%61dmin/export` reach the handler unchecked.
- Why it gets written: guarding by path in one middleware looks central and complete.
- Verification: signed out, GET `/api/admin/export/`, `/api/%61dmin/export` and HEAD `/api/admin/export` all return 401.
- Solutions:
  - [best] Check inside the handler (`requireUser` and a role), as M does in every route.
  - [acceptable] ViteHub `access.routes: ['/api/admin/**']`, which matches as the router reads paths since `8c2b89d5e2` (#4288; `packages/auth/src/application-path.ts:41`).
  - [over-engineered] Your own path normalizer.
  - [masks-symptom] Add `startsWith` and more string variants.
  - [wrong] Block `%` in URLs.
- Agent traps: patches the one string compare.
- Evidence: real, `8c2b89d5e2` (#4288).
- Difficulty: 3 · Static-detectable: yes

### AU5 Reset links point at a stranger's domain
- Type: both · Class: security · Primitive(s): Auth, Runtime
- Fixture: M, `server/auth.ts`. `baseURL: requestOrigin` instead of `siteUrl || requestOrigin`, and remove `NUXT_PUBLIC_SITE_URL` from the deployment docs. 1 line.
- Report (a security researcher): "Your password-reset email links to whatever Host I send."
- Root cause: the link's origin comes from the request's Host header.
- Why it gets written: in a request handler, "the current origin" feels free. Jobs and schedules have none, so authors cache or derive it.
- Verification: request a reset with `Host: evil.test`; `hub.emails[0]` links to the configured origin.
- Solutions:
  - [best] A configured public origin: M's `NUXT_PUBLIC_SITE_URL`, or `vitehub({ publicUrl })` with `resolvePublicUrl()` (`packages/runtime/src/public-url.ts:51`; since `1a644ec64c` #4293, ViteHub never takes it from Host when `publicUrl` is set).
  - [acceptable] An allowlist of Host values against trusted origins.
  - [over-engineered] Per-tenant origin tables.
  - [masks-symptom] Ignore only `X-Forwarded-Host`. Host is still the client's choice.
  - [wrong] `getRequestURL(event, { xForwardedHost: true })`.
- Agent traps: trusts forwarded headers.
- Evidence: real, `1a644ec64c` (#4293); joxi `9f1bd85` finding 14 (scheduled emails linked to the last request's Host); M's comment in `mail.ts`.
- Difficulty: 2 · Static-detectable: yes

### AU6 A stranger has an account on my invite-only site
- Type: both · Class: security · Primitive(s): Auth (Better Auth hooks)
- Fixture: S, nuxt-evals `site/server/auth.ts` as of `0bb47fe`: `databaseHooks.user.create.before` lets any `@guests.invalid` email through, then refuses sign-up once a user exists. About 15 lines.
- Report: "Sign-up is supposed to be closed, but there's a new account I didn't make."
- Root cause: the hook trusts an attacker-controlled field (email) to tell server-made users from public sign-ups.
- Why it gets written: the same hook runs for public sign-up and for server `createUser`, and the email looks like a safe marker.
- Verification: with one user seeded, `POST /api/auth/sign-up/email` with `x@guests.invalid` returns 403 and the count stays 1; a role-carrying server `createUser` still succeeds.
- Solutions:
  - [best] Trust only fields sign-up can't set, such as `role` (`input: false` under `admin()`) (`8b32030`).
  - [acceptable] An invitations table checked in the hook.
  - [over-engineered] Separate auth instances for guests.
  - [masks-symptom] Hide the sign-up form.
  - [wrong] Validate the email domain format.
- Agent traps: hides the form.
- Evidence: real, nuxt-evals `0bb47fe` (hole) → `8b32030` (fix).
- Difficulty: 3 · Static-detectable: yes

### DB1 Seats left goes negative when two people RSVP at once
- Type: both · Class: bug · Primitive(s): Database
- Fixture: M, `server/api/events/[slug]/rsvp.post.ts`. Replace the one conditional `insert … select … where count < capacity` with `const left = await seatsLeft(id); if (left <= 0) throw 409; await db.insert(rsvps)…`, and drop the `max(…, 0)` in `seatsLeft`. About 12 lines.
- Report: "Seats left goes negative when two people RSVP at once." (Maxi's example.)
- Root cause: check-then-insert across `await`. Two requests both read a free seat, then both insert.
- Why it gets written: the natural top-to-bottom code. Every `await` yields even on one Node process, and D1 has no interactive transactions to hide it in (subagent: `workspace/hosts.md:33`).
- Verification: 20 users RSVP at once to a 5-seat event, against **two server processes** on one database file. Expect exactly 5 rows, 15 × 409, and `seatsLeft >= 0`. Two processes catch an in-memory mutex.
- Solutions:
  - [best] One conditional `INSERT … SELECT … WHERE (select count) < capacity ON CONFLICT DO NOTHING RETURNING` (M).
  - [acceptable] A counter column with `UPDATE … SET taken = taken + 1 WHERE taken < capacity RETURNING`, then the insert in `db.batch()`. Works on D1.
  - [acceptable] A `BEFORE INSERT` trigger with `RAISE(ABORT)` (drop `7093d7c0`: Better Auth's org member limit raced the same way).
  - [acceptable, not portable] `db.transaction()` with a write lock on SQLite or libSQL. Fails on D1.
  - [over-engineered] A Queue with concurrency 1 per event, a Durable Object, or a KV lock.
  - [masks-symptom] Clamp the display with `max(0)`; disable the button.
  - [wrong] An in-memory mutex per event. It passes a one-process test.
- Agent traps: clamps the number; adds a mutex; reaches for `db.transaction` on a D1-bound app.
- Evidence: M's design; drop `7093d7c0`; joxi `9f1bd85` (`reserveSync` conditional update).
- Difficulty: 3 · Static-detectable: yes

### DB2 The organizer dashboard takes 4 seconds
- Type: A · Class: perf · Primitive(s): Database
- Fixture: M, `server/api/dashboard.get.ts`. Select the organizer's events, then `for (const e of rows) e.seatsLeft = await seatsLeft(e.id)`. Seed an organizer with 80 events. About 8 lines.
- Report: "The dashboard takes 4 seconds for organizers with a lot of events."
- Root cause: N+1 queries. Each is a round trip on libSQL, Turso or D1.
- Why it gets written: helpers like `seatsLeft()` exist, and a loop over them is the obvious reuse. Local SQLite makes each call nearly free.
- Verification: `database.calls` on the request's wide event (`packages/database/src/runtime/request-stats.ts:6,43`) is ≤ 2. With 20 ms of injected latency per query, p50 < 100 ms.
- Solutions:
  - [best] One grouped query with a `count` join (M's `dashboard.get.ts`).
  - [acceptable] A correlated subquery in the select.
  - [over-engineered] A denormalized `taken` column kept by triggers.
  - [masks-symptom] `Promise.all`. Fewer waits, same calls.
  - [masks-symptom] Cache the dashboard.
  - [wrong] Paginate to 10 events.
- Agent traps: `Promise.all` and done; caches.
- Evidence: ViteHub `98950de406` (#2694; `calls: 9, maxConcurrent: 1` is the signature, per the subagent). drop `a4996961`; babysitter `94cf746a1` (filtering big JSON in JS).
- Difficulty: 2 · Static-detectable: yes

### DB3 The event page waits in line
- Type: A · Class: perf · Primitive(s): Database, Auth
- Fixture: M, `server/api/events/[slug]/index.get.ts`. Run the 5 reads one after another (event, session, organizer, seats, going), and have the page `await useFetch` the event and then `await useFetch` its seats. About 10 lines.
- Report: "Event pages take a second to show anything."
- Root cause: independent round trips run in series, on the server and again in the page.
- Why it gets written: plain top-to-bottom async code.
- Verification: `maxConcurrent` (`request-stats.ts:9`, "1 means every call waited for the one before it") ≥ 3. With 50 ms per query injected, TTFB drops by about 150 ms. There is one page request for the seats.
- Solutions:
  - [best] `Promise.all` for the independent reads (M), and seats included in the event response.
  - [acceptable] One joined query.
  - [over-engineered] A cache layer per piece.
  - [masks-symptom] Stream with `lazy: true`.
  - [wrong] Cache the event page for everyone. It shows `going` per user.
- Agent traps: contrast with DB2. Here `Promise.all` is best; there it masks. Rewarding the same move differently shows whether the agent read the cause.
- Evidence: real, drop `a4996961` (11 → 3 round trips) and `d7ca11fb` (layout waterfall).
- Difficulty: 2 · Static-detectable: partly

### DB4 Attendee import works locally and fails on Cloudflare
- Type: both · Class: nook · Primitive(s): Database (D1)
- Fixture: M, switched to `host: 'cloudflare'` for this case. Add `POST /api/events/[slug]/invites`, which imports 60 emails with `db.insert(invites).values(rows)` (4 columns), plus "remove selected" with `inArray(rsvps.id, ids)`. About 25 lines. Variant: a hand-tuned `const CHUNK = 25` plus a task "add a `note` column".
- Report: "Importing my attendee list fails on the live site. It works on my laptop."
- Root cause: D1 allows 100 bound parameters per statement; 60 × 4 = 240. In the variant, the new column pushes a hand-tuned chunk over 100.
- Why it gets written: libSQL allows 32,766 variables, Drizzle doesn't warn, and the constant lives far from the schema.
- Verification: vite dev with `host: 'cloudflare'` checks D1 limits (`59b44644ad`, #3443). It throws `DATABASE_D1_TOO_MANY_PARAMETERS` (`packages/database/src/runtime/d1-limits.ts:31`) before the fix, and 250 rows succeed after.
- Solutions:
  - [best] `chunkParameters(rows, { reserved })` (`packages/database/src/runtime/chunk-parameters.ts:23`, `6e0d4f1187` #3270), inside `db.batch()` when it must be atomic.
  - [acceptable] A chunk size derived from `getTableColumns(table)`.
  - [acceptable] One JSON parameter with `json_each`.
  - [masks-symptom] One row per statement. N round trips.
  - [wrong] A hard-coded chunk. It breaks on the next column (joxi `c8cb008`: 7 × 14 = 98, then 15 columns made 105).
- Agent traps: hard-codes the chunk; can't reproduce without the Cloudflare host.
- Evidence: real, `6e0d4f1187`, `59b44644ad`; joxi `c8cb008`.
- Difficulty: 3 · Static-detectable: yes

### DB5 The generated migration would log everyone out
- Type: both (B primarily) · Class: bug · Primitive(s): Database (D1 migrations), Auth tables
- Fixture: S, nuxt-evals `site/`. Adding Better Auth organization tables makes `drizzle-kit generate` rebuild `user`, `session` and `account` (create `__new_x`, copy, `DROP`, rename). The planted migration is that generated file. About 60 SQL lines.
- Report (A variant): "We're adding teams. Here's the migration; make it safe to deploy."
- Root cause: on D1, `DROP TABLE user` cascades through `ON DELETE CASCADE`, so sessions and passkeys are deleted. `PRAGMA foreign_keys=OFF` has no effect there.
- Why it gets written: people trust `drizzle-kit generate`, and the rebuild is noise in a long diff.
- Verification: apply the migrations to a copy of a seeded database; session and account counts are unchanged.
- Solutions:
  - [best] A hand-trimmed migration: `CREATE TABLE` for the new tables and `ALTER TABLE session ADD active_organization_id` (`6b37d2d`).
  - [acceptable] Back up, migrate, and restore sessions (heavy).
  - [over-engineered] A blue-green copy of the database.
  - [masks-symptom] Run it at night.
  - [wrong] `PRAGMA foreign_keys=OFF` at the top.
- Agent traps: applies it as generated.
- Evidence: real near-miss, nuxt-evals `6b37d2d` (the commit says so). The "before" was never committed; regenerate it.
- Difficulty: 4 · Static-detectable: yes

### KV1 A single-use invite code works twice
- Type: both · Class: nook · Primitive(s): KV
- Fixture: M. Add invite codes for private events. `redeem.post.ts` does `const [, used] = await kv.get(k); if (used) throw 409; await kv.set(k, user.id); insert rsvp`, with no `ttl`. About 20 lines.
- Report: "One invite code got five people into a private event."
- Root cause: `get`-then-`set` is not atomic. Concurrent requests all see the code as unused. The codes also never expire.
- Why it gets written: it is the natural pattern. The docs warn against it in so many words (`kv/server-api.md:129`), but nothing in the API stops it.
- Verification: 20 parallel redeems of one code give 1 success. After the TTL, the code is gone.
- Solutions:
  - [best] `kv.setIfAbsent(k, userId, { ttl })`. Atomic on database, redis, upstash, deno-kv and fs-lite; `KV_UNSUPPORTED_OPERATION` on Cloudflare KV (`kv/server-api.md:131-140`; `b8a9a9b409` #3207).
  - [acceptable] A unique `redemptions(code)` insert with `ON CONFLICT DO NOTHING RETURNING`. Works on D1 too (`frameworks-hosts/production.md:65`).
  - [acceptable] `getAndDelete` on database, redis or upstash (`packages/kv/src/types.ts:12,15-16`).
  - [over-engineered] A Durable Object or a Queue that serializes redemptions.
  - [masks-symptom] Disable the button.
  - [wrong] An in-memory `Set`.
- Agent traps: forgets the TTL. In dev, fs-lite ignored `ttl` until `ae217627b4` (#4226), and the NuxtHub migration doc still says it does (`getting-started/migrate-from-nuxthub.md`, KV section), which contradicts `kv/server-api.md:137`. That stale doc line is itself a finding.
- Evidence: real, `b8a9a9b409`, `ae217627b4`.
- Difficulty: 2 · Static-detectable: yes

### KV2 The exchange-rate bill tripled
- Type: A · Class: perf · Primitive(s): Cache (KV), Env
- Fixture: M, `server/api/rates.get.ts`. Fetch the paid rates API in the handler on every request, with no cache. About 10 lines. Variant: a module-level `let cached` with no TTL, on 3 instances.
- Report: "Our exchange-rate provider bill tripled and pages got slower." Variant: "prices are a day old on one server only."
- Root cause: the paid upstream is called per request; in the variant, the cache is per instance with no expiry.
- Why it gets written: one fetch in a handler is the simplest code. Nitro's cache is in memory per instance by default (subagent: `kv/configure.md:186`).
- Verification: 50 requests in 10 minutes make ≤ 1 upstream call (Meetups F7 probe). A restart doesn't refetch while the entry is fresh.
- Solutions:
  - [best] `defineCachedFunction(…, { maxAge: 3600, swr: true })` with `vitehub: { cache: true }`, a shared store (M's `rates.get.ts`).
  - [acceptable] KV with a `ttl`, by hand.
  - [over-engineered] A Schedule that pre-fetches into KV, with a fallback.
  - [masks-symptom] Client-side caching in `localStorage`.
  - [wrong] A module-level variable with no TTL.
- Agent traps: caches on the client; forgets `swr`, so a visitor waits on the refresh.
- Evidence: M's design; plan-v2 F7.
- Difficulty: 2 · Static-detectable: partly

### KV3 Prices stuck in euros until we restart
- Type: both · Class: bug · Primitive(s): none (a pattern ViteHub had in 16 places)
- Fixture: M. A rates client memoized as `client ??= connect()`, where `connect()` fetches a token. About 10 lines.
- Report: "After yesterday's outage at the rates provider, prices stayed in euros until we restarted the server."
- Root cause: the memoized promise keeps its rejection forever.
- Why it gets written: `??=` caching of a promise is idiomatic and looks right.
- Verification: the first call fails (mocked) and the second succeeds.
- Solutions:
  - [best] Clear the memo on rejection: `x ||= load().catch(e => { x = undefined; throw e })` (`52f15464c0`).
  - [acceptable] Don't memoize; connect per call.
  - [over-engineered] A circuit-breaker library.
  - [masks-symptom] A scheduled restart.
  - [wrong] Catch and resolve `undefined` forever.
- Agent traps: adds retries inside `connect()` but keeps the rejected memo.
- Evidence: real, ViteHub `52f15464c0` (#3986: 16 places).
- Difficulty: 2 · Static-detectable: yes

### RL1 The RSVP limit never trips
- Type: both · Class: nook · Primitive(s): Rate-limit
- Fixture: M, `rsvp.post.ts`. `if (!(await checkRateLimit(event.req, 'rsvp', { limit: 20, window: '1m', key: user.id }))) throw 429`. Variants: `requireRateLimit(…)` without `await`, or a memory limiter created inside the handler. 1 line.
- Report: "Someone RSVP'd and cancelled 3,000 times in a minute. Doesn't the limit do anything?"
- Root cause: `checkRateLimit` returns a `[error, decision]` tuple, which is always truthy. The variants: an unawaited guard, or fresh counters on every request.
- Why it gets written: boolean-looking APIs, and a Result change in `43128a213e`.
- Verification: 21 requests in a minute; the 21st gets 429. Static checks: Doctor VHUB0006 (`doctor-rules.md:335`), VHUB0008 (`:424`) and VHUB0009 (`:453`).
- Solutions:
  - [best] `await requireRateLimit(event.req, name, opts)` (`packages/rate-limit/src/guard.ts:149`).
  - [acceptable] `const [e, d] = await checkRateLimit(…); if (e || !d.allowed) throw 429` (`guard.ts:140`).
  - [over-engineered] A hand-written token bucket in KV.
  - [masks-symptom] A client-side throttle.
  - [wrong] Lower `limit`.
- Agent traps: lowers the limit.
- Evidence: real, `43128a213e`, `49f1002aaa` (rules).
- Difficulty: 1 · Static-detectable: yes

### RL2 Half our users see "Too many attempts"
- Type: A · Class: nook · Primitive(s): Rate-limit, Auth
- Fixture: M behind nginx, with `trustProxy: false`. The test client sends through one proxy address. Config only.
- Report: "Since we moved behind nginx, lots of people get 'Too many attempts' when they sign in."
- Root cause: with no `key`, limits count by the client address the host reports, which is the proxy's (`rate-limit/server-api.md:26-28`). Better Auth's limiter likewise counts the proxy unless `advanced.trustedProxyHeaders` is set (M's `server/auth.ts`).
- Why it gets written: it works in dev; the proxy changes the peer address.
- Verification: two clients through one proxy with different `X-Forwarded-For` have separate counters, and a spoofed header sent directly to the app doesn't reset a counter.
- Solutions:
  - [best] Trust the proxy explicitly: `NUXT_TRUST_PROXY=true` for Better Auth (M), plus ViteHub `trustProxy` (`frameworks-hosts/node-self-hosted.md:107-110`).
  - [acceptable] Key app limits by user id or email.
  - [over-engineered] A separate rate-limit service at the proxy.
  - [masks-symptom] Raise the limits.
  - [wrong] Key by a client-sent `x-forwarded-for` without trusting the proxy. It is spoofable.
- Agent traps: reads `x-forwarded-for` directly.
- Evidence: M's comments; ViteHub `7e659657dc` (#4245: anonymous Agent callers shared one counter).
- Difficulty: 3 · Static-detectable: partly

### RT1 A coworker edited my private note
- Type: both · Class: security · Primitive(s): Realtime, Auth
- Fixture: S, a small notes app (console repo shape): `defineRealtime({ auth: true, document: … })` with no `authorize`. About 20 lines.
- Report: "A coworker edited my private note."
- Root cause: signed-in is not authorized. No per-document rule, so any user opens any room for writing.
- Why it gets written: `auth: true` reads like access control.
- Verification: user B's WebSocket to A's private doc is refused, or read-only.
- Solutions:
  - [best] `authorize: ({ user, documentId, mode }) => …` with an ownership check (`packages/realtime/src/definition.ts:9,19-24`).
  - [acceptable] One document namespace per user.
  - [over-engineered] A proxy that re-checks every Yjs update.
  - [masks-symptom] Unguessable document ids.
  - [wrong] Check only in the page.
- Agent traps: checks only in the UI.
- Evidence: real, `d82121cb6c` (#4294: before it, a definition with no rule let anyone read and overwrite every document). Guess: whether `auth: true` alone passes #4294's validation on `main`; check `definition.ts:19-24`.
- Difficulty: 3 · Static-detectable: yes

### EN1 Rates return 401 only in production
- Type: both · Class: nook · Primitive(s): Env
- Fixture: M. Move the rates key to a sealed Server Env value, `env({ secret: true, source: env.source('RATES_API_KEY') })`, read it with `useServerEnv()` (`packages/env/src/runtime/server-env.ts:19`), and send `` `Bearer ${env.rates.apiKey}` ``. About 5 lines.
- Report: "Prices show in euros only in production, and the rates provider logs 401s from us."
- Root cause: a sealed secret interpolates as a redacted string, so the header carries the redacted text.
- Why it gets written: it looks like a string, and ViteHub doesn't report the misuse at runtime.
- Verification: the outbound mock receives the real token. Static check: Doctor VHUB0004 (`doctor-rules.md:222`).
- Solutions:
  - [best] `.unseal()` at the call site (`packages/env/src/secret.ts:10`), never logged.
  - [acceptable] Nuxt `runtimeConfig` (server-only), as M does.
  - [over-engineered] A secrets manager client.
  - [masks-symptom] Hard-code the key in an env file that is read directly.
  - [wrong] `process.env` in the Vite config, which bakes the secret into the build (VHUB0005, `doctor-rules.md:283`).
- Agent traps: logs the key to debug it.
- Evidence: real, Doctor rules `49f1002aaa`; `1ab2fa54d9` (#4258: an empty variable now counts as missing).
- Difficulty: 2 · Static-detectable: yes

### AG1 Backfill says it labelled 200 emails; none have labels
- Type: A · Class: nook · Primitive(s): Agent (hooks, presets), Channels
- Fixture: S, email-labeller at `b2b6f33^`. `server/lib/replay.ts` defines its own `agent:finish` hook on top of the labeller preset. About 25 lines.
- Report: "Backfill says it labelled 200 emails but none have labels in Gmail."
- Root cause: ViteHub merges hooks as `{ ...parent, ...child }`, so the child's hook replaced the preset's hook, which applies labels.
- Why it gets written: layered config looks additive.
- Verification: after a backfill, the mocked channel receives `modify` calls equal to the decisions.
- Solutions:
  - [best] Call the preset's hook from the child (`labeller.hooks?.['agent:finish']`, the real fix, read).
  - [acceptable] Collect decisions from the journal instead of a hook.
  - [over-engineered] Fork the preset.
  - [masks-symptom] Apply labels in a second pass.
  - [wrong] Remove the replay hook, which loses the report.
- Agent traps: debugs Gmail auth.
- Evidence: real, email-labeller `b2b6f33` (read). The hook entry is `packages/agent/src/index.ts:4885`; I did not find the merge site on `main` (guess: unchanged).
- Difficulty: 3 · Static-detectable: partly

### MG1 Move a NuxtHub app to ViteHub
- Type: A · Class: migration · Primitive(s): Database, KV, Blob, Cache
- Fixture: L. M's server on `@nuxthub/core` v0.10: `kv`, `blob` and `db` from `@nuxthub/*`, Drizzle 0.x relational queries, `hub: { db, kv, blob, cache }`, data in `.data/`, and migrations in `_hub_migrations`. Seeded data must survive. About 1.5k lines.
- Report: "Move this NuxtHub app to ViteHub. Production data must survive."
- Root cause: n/a. The traps come from `getting-started/migrate-from-nuxthub.md` (read):
  - KV, Blob and DB calls return `[error, value]`.
  - `blob.head()` returns `null` instead of throwing 404.
  - Drizzle relational v1 → v2: `defineRelations`, and `where` objects instead of callbacks.
  - `TURSO_DATABASE_URL`, `REDIS_URL` and `POSTGRES_URL` are no longer read automatically.
  - KV keys move under `vitehub:kv:<store>`.
  - `useUpload()` returns an array.
  - Multipart `concurrent` becomes `concurrency`.
  - `blob.serve` now sends `private, no-cache`.
  - Wrangler's history table must not be set to `_hub_migrations`.
- Why it gets written: same method names. "Same core methods" hides the changed return shape.
- Verification: the M probe subset passes; event and RSVP counts match the seed; no migration re-runs; KV values are readable after the move; static: no `@nuxthub/*` imports and no undestructured tuples (VHUB0003).
- Solutions:
  - [best] Follow the doc: tuples handled at each call, a baseline migration, explicit `connection`, and the KV key move script.
  - [acceptable] Same, with relational queries rewritten as `db.select`.
  - [over-engineered] A compatibility shim that re-throws tuples.
  - [masks-symptom] A fresh database and re-seed.
  - [wrong] Set Wrangler's history table to `_hub_migrations`.
- Agent traps: `const s = await kv.get(k)` (a tuple, always truthy); forgets the env var; re-applies migrations.
- Evidence: the doc (read); `e4cb99267c` (#4221, `DATABASE_URL_VARIABLE_IGNORED`). The fixture is synthetic.
- Difficulty: 4 · Static-detectable: partly

### MG2 Old h3 v1 handlers on Nitro v3
- Type: A · Class: migration · Primitive(s): none (h3, Nitro)
- Fixture: L's `server/`, written in h3 v1 style: `event.node.req`, `getHeader`, `readMultipartFormData`, `setResponseHeader`, `send(event, …)`, `sendRedirect`, `createError({ statusCode, statusMessage })`, and a guard that relied on `readBody` throwing on an empty body.
- Report: "Upgrade the server code to Nuxt 5 / Nitro 3. It still uses the old h3 style."
- Root cause: n/a. These traps come from h3's migration guide (`docs/5.migration/0.index.md`, read on GitHub):
  - Body utils return empty values instead of throwing.
  - `readBody` no longer uses destr, so prototype poisoning is the app's job.
  - `getRequestURL` no longer trusts `x-forwarded-proto`.
  - Header values are always strings.
  - `send*` helpers become a `return`.
  - `readMultipartFormData` becomes `event.req.formData()`.
- Why it gets written: v1 code still half-works through compatibility.
- Verification: build, typecheck, M's route probes, and a body-poisoning probe (`{"__proto__":{"admin":true}}`). Static: no v1 helpers. M's `createError({ status, statusText })` from `nuxt/server` is the target form (read in M).
- Solutions:
  - [best] Web `Request` and `Response` APIs and `nuxt/server` imports, plus schema validation of bodies (M).
  - [acceptable] Keep deprecated aliases that still exist.
  - [over-engineered] Rewrite as a separate H3 app.
  - [masks-symptom] `event.runtime.node` everywhere.
  - [wrong] Drop validation because `readBody` "no longer throws".
- Agent traps: keeps `event.node.req` (Node-only); forgets `return` on redirects.
- Evidence: h3 guide; M as the target. The fixture is synthetic.
- Difficulty: 3 · Static-detectable: yes

### MG3 Bump ViteHub and CI goes red
- Type: A · Class: migration · Primitive(s): Queue, Blob, Workflow, codemods
- Fixture: M at pin `1e807fc9` (2026-11-08), bumped to `main`.
- Report: "Bump ViteHub to latest. CI is red after the bump."
- Root cause: n/a. The breaking changes between the pin and `main` (each read):
  - `runQueue` → `sendQueue` (`8785e98e44`, #3714; codemod `queue-workflow-verbs`, `codemods/upgrade-vitehub.md:64-69`).
  - The `{ id }` enqueue option is gone (`a7e0b8e916`).
  - Blob serve must say `access: 'public'` or `authorize: true`, or the build fails `BLOB_C0021` (`blob/configure.md:81`). M's `/images` route sets neither.
  - Per-put `access` throws `BLOB_R0045`.
  - Guess: the Drizzle 1.0 rc requirement (`migrate-from-nuxthub.md`) vs M's `drizzle-orm` 0.45.4.
- Why it gets written: early-stage APIs change weekly. The codemod exists, but agents don't know to look.
- Verification: build plus all M probes at `main`. Static: no `runQueue`, and serve access is explicit.
- Solutions:
  - [best] `npx @vite-hub/codemods`, then fix what the diagnostics name (`upgrade-vitehub.md:9`).
  - [acceptable] Hand edits that land the same code.
  - [over-engineered] A local wrapper keeping the old names.
  - [masks-symptom] Pin back to the old version.
  - [wrong] `serve: { access: 'public' }` on a store that also holds private files (with BL1 planted).
- Agent traps: never finds the codemod; picks `public` without looking at what the store holds.
- Evidence: real, commits listed. This doubles as the "primitive use" case for codemods.
- Difficulty: 3 · Static-detectable: partly

### MG4 Every deploy wipes all events
- Type: A · Class: migration · Primitive(s): Database
- Fixture: L or M. `defineDatabase({ schema })` with no `connection`; `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set in the container, as NuxtHub read them.
- Report: "Every time we deploy, all events are gone."
- Root cause: the Definition reads only its `connection`, so data goes to `.vitehub/data/database/sqlite.db` on an ephemeral container disk.
- Why it gets written: NuxtHub read the variable on its own (`migrate-from-nuxthub.md`, "Keep a Turso or libSQL connection", read).
- Verification: boot with the variable set; no `DATABASE_URL_VARIABLE_IGNORED` warning; writes land in libSQL (a mock server counts them).
- Solutions:
  - [best] `connection: { url, authToken }` from env (M uses `env({ source: env.source('DATABASE_URL') })`).
  - [acceptable] Mount a volume for `.vitehub/data` and keep SQLite (one instance only).
  - [over-engineered] A sync script from SQLite to Turso.
  - [masks-symptom] A backup and restore on deploy.
  - [wrong] Rename the variable to `DATABASE_URL` and still pass no `connection`.
- Agent traps: blames the deploy.
- Evidence: real, `e4cb99267c` (#4221); `packages/database/src/runtime/url-variables.ts:33` (subagent).
- Difficulty: 2 · Static-detectable: yes

### NX1 For a second I see someone else's name
- Type: both · Class: security · Primitive(s): none (Nuxt SSR state)
- Fixture: M, `app/composables/useAuth.ts`. `const user = ref<SessionUser | null>(null)` at module scope instead of `useState`. 1 line.
- Report: "For a second after the page loads I see another person's name in the header."
- Root cause: module state is shared across concurrent SSR requests on the server.
- Why it gets written: it works in a SPA and in dev with one user.
- Verification: 50 rounds of two concurrent SSR requests with different cookies; each HTML contains only its own name.
- Solutions:
  - [best] `useState` (M), or the ViteHub session store.
  - [acceptable] `provide`/`inject` from a plugin per app instance.
  - [over-engineered] A Pinia store for one value.
  - [masks-symptom] `<ClientOnly>` around the name.
  - [wrong] Reset the ref in a middleware (still races).
- Agent traps: `ClientOnly`.
- Evidence: nuxt/nuxt#19623 ("cross-request state pollution when `useAsyncData` is used in a plugin", title checked).
- Difficulty: 2 · Static-detectable: yes

### NX2 The start time flickers
- Type: A · Class: bug · Primitive(s): none (Vue hydration)
- Fixture: M, `app/components/EventStart.vue`. Replace `<NuxtTime>` with `new Date(startsAt).toLocaleString()` and a hand-rolled "in 3 hours". About 8 lines.
- Report: "The time on event pages jumps after load, and the console has warnings."
- Root cause: the server and the browser format in different time zones and at different `now`s, so hydration mismatches.
- Why it gets written: `toLocaleString()` looks harmless.
- Verification: Playwright with the browser TZ different from the server's: 0 hydration warnings (Meetups F3).
- Solutions:
  - [best] `<NuxtTime>` (M's `EventStart.vue`).
  - [acceptable] Format in the event's own time zone on both sides, and compute the relative time after mount.
  - [over-engineered] A date library and a custom directive.
  - [masks-symptom] `<ClientOnly>`, or `data-allow-mismatch`.
  - [wrong] Pass the server's time zone to the client.
- Agent traps: `ClientOnly`.
- Evidence: M's design; plan-v2 F3.
- Difficulty: 2 · Static-detectable: partly

### NX3 Someone changed the title of my event
- Type: both · Class: security · Primitive(s): Auth
- Fixture: M. `index.patch.ts` and `attendees.csv.get.ts` use `findEventBySlug` instead of `findOwnedEvent`. 2 lines.
- Report: "Someone changed the title of my event. I'm the only organizer."
- Root cause: authentication without authorization (IDOR).
- Why it gets written: `requireUser` at the top looks like "protected".
- Verification: user B's PATCH and CSV GET on A's event return 404.
- Solutions:
  - [best] An ownership check in the query, with 404 for strangers (M's `findOwnedEvent`).
  - [acceptable] Return 403 instead of 404.
  - [over-engineered] A role or permission framework.
  - [masks-symptom] Hide the Edit button.
  - [wrong] Check ownership on the client.
- Agent traps: fixes PATCH and misses the CSV route.
- Evidence: M's design; joxi `1fd3769` (a bulk update skipped per-row ownership inside a tenant).
- Difficulty: 1 · Static-detectable: yes

### NX4 Someone changed their email to mine
- Type: both · Class: security · Primitive(s): Auth, Database
- Fixture: M. Add `server/api/account.patch.ts` with `db.update(users).set(await readBody(event)).where(eq(users.id, user.id))`. About 8 lines.
- Report: "Someone's account now shows my email address, marked verified."
- Root cause: mass assignment. The body sets `email`, `emailVerified` and any other column.
- Why it gets written: `.set(body)` is the shortest update.
- Verification: a PATCH with `{ emailVerified: true, email: x }` is refused or ignored; `{ name }` works.
- Solutions:
  - [best] `readValidatedBody` with a strict schema of the editable fields (M's shared schemas), or Better Auth `updateUser`, which refuses `input: false` fields.
  - [acceptable] Pick the fields by hand.
  - [over-engineered] A field-level ACL layer.
  - [masks-symptom] Strip `email` only.
  - [wrong] Validate types but keep the passthrough.
- Agent traps: blacklists the fields.
- Evidence: synthetic; the pattern appears in no repo history I read.
- Difficulty: 1 · Static-detectable: yes

### NX5 Our rates key leaked
- Type: both · Class: security · Primitive(s): Env (Nuxt runtimeConfig)
- Fixture: M. `runtimeConfig.public.ratesApiKey`, and the rates are fetched in `app/plugins/rates.ts` straight from the provider. About 10 lines.
- Report: "The rates provider says our key leaked and someone is burning our quota."
- Root cause: a secret in public runtime config is serialized into the payload and the client bundle.
- Why it gets written: the client plugin "just needs the key".
- Verification: `.output/public` and the SSR payload don't contain the key; ≤ 1 upstream call in 10 minutes (F7).
- Solutions:
  - [best] A server route with `defineCachedFunction`, with the key in private `runtimeConfig` (M).
  - [acceptable] A server proxy route with no cache. It fixes the leak, not the cost.
  - [over-engineered] A separate rates microservice.
  - [masks-symptom] Rotate the key.
  - [wrong] Obfuscate or base64 the key.
- Agent traps: rotates the key and stops.
- Evidence: M's design; plan-v2 F7.
- Difficulty: 1 · Static-detectable: yes

## B-only plants (small, for hidden-bug fixtures)

One line each. Each is a plant a static scan should find; severity is in brackets.

1. [high] The CSV export without M's `csvField` lets a cell start with `=`: formula injection (M `attendees.csv.get.ts`).
2. [high] `?redirect=` passed to `navigateTo` without M's `safeRedirect` (`app/utils/redirect.ts`): an open redirect.
3. [high] The event description rendered with `v-html`: stored XSS.
4. [medium] LIKE without M's `ESCAPE` (`server/api/events/index.get.ts`): `%` matches everything (drop `f369d248`).
5. [medium] A bearer token compared with `!==` instead of a timing-safe compare (current nuxt-evals `site/server/utils/ingest.ts:8`, a real current-code find).
6. [high] A blob key built from user input that ViteHub percent-decodes: `%2e%2e/` traversal (drop `3253db64`). Guess: whether `main` still decodes.
7. [medium] A claim not released on an early `return` path (babysitter `39f7a3fd7`).
8. [medium] Queue options in the payload: `sendQueue('x', { payload, delaySeconds })` (VHUB0016, `doctor-rules.md:645`).
9. [medium] `sendQueue` at module scope in a Nitro plugin (VHUB0017, `:671`).
10. [medium] A GET handler that writes, with a D1 read replica. The next GET reads stale data (`022a06da40`, #2693).
11. [high] Cookie-authenticated writes with `SameSite=None` and no origin check: CSRF. ViteHub has `sameOriginWrites: true` (`frameworks-hosts/node-self-hosted.md:109-120`); joxi `1c973b6`.
12. [medium] A sync error message shown to every household member, including a partner's private account names (joxi `1fd3769`).
13. [low] A `setTimeout` in a `watch` without `onCleanup` (drop `0664609b`).
14. [medium] A memory rate limiter created inside the handler (VHUB0009).

## M as an oracle

M's comments document each bug it avoids. Each comment is a plant, and M's code is its best fix:
- the seat race (`rsvp.post.ts`);
- the duplicate RSVP (unique index);
- the queued-job dedupe (`idempotencyKey`);
- the claim-before-send (`mail.ts`);
- Host-header links (`mail.ts`, `auth.ts`);
- LIKE escaping;
- shared rates cache with `swr`;
- cover orphaning and parallel uploads (`cover.put.ts`);
- byte-sniffed uploads;
- CSV injection;
- the open redirect;
- `trustedProxyHeaders`;
- `NuxtTime` hydration;
- a 404 that doesn't reveal ownership.

That is about 15 cases with no new design work. Grep the comment, invert the code, strip the comment.

## The 20 to build first, and why

All are on M unless noted. Each has a real or reference best fix and a deterministic check; together they cover every class and difficulty 1–4.

| # | Case | Why first |
| --- | --- | --- |
| 1 | DB1 seats race | Maxi's example. The two-process test separates real fixes from mutexes. |
| 2 | QW1 swallowed send | ViteHub's commonest nook (tuples). One line. Doctor gives a static oracle. |
| 3 | QW2 retry resends | At-least-once. Many plausible fixes to rank. |
| 4 | QW3 reminders twice | Schedule nook. `hub.runSchedule` makes it deterministic. |
| 5 | AU1 per-card session fetch | The "Vue portal" class, measured in drop. A perf case with a call count. |
| 6 | AU2 global session read | Pairs with AU1, on the server side. |
| 7 | AU3 cached per-user handler | Security. A trivial check; many agents add caching. |
| 8 | AU5 Host-header links | Real in ViteHub and joxi. One line. |
| 9 | BL1 private tickets | The newest ViteHub fix (#4289). Tests reading primitive semantics. |
| 10 | BL5 cover never updates | A one-line plant with a clever cause. Masking (`no-store`) is likely. |
| 11 | BL3 video Range | `blob.serve` vs hand-rolled: a clear primitive-use signal. |
| 12 | DB2 N+1 dashboard | A classic perf case. `Promise.all` is a measurable mask. |
| 13 | DB3 waterfall | The contrast case to DB2. |
| 14 | DB4 D1 parameters | A pure ViteHub/D1 nook with a dev-time check. |
| 15 | KV1 invite code race | `setIfAbsent`; the docs warn but agents still `get`/`set`. |
| 16 | KV2 rates uncached | An F7 probe already exists. |
| 17 | RL1 limit never trips | Difficulty 1. Calibrates the floor. |
| 18 | NX3 IDOR | Difficulty 1 security. Calibrates the floor. |
| 19 | MG1 NuxtHub → ViteHub (L) | The migration class Maxi named. The doc gives the solution list. |
| 20 | MG3 ViteHub bump | Real breaking changes and a real codemod. Fixture is free (M at its pin). |

The J cases (QW4, QW6–QW11, AG1) come in wave 2, once J exists. They are the best sources for Workflow and job-state nooks, but J costs about a day to build. For B, start with one fixture: M plus 8 plants (QW1, AU3, AU5, BL2, DB1, KV1, NX3, and B-only #1), with no count given.

## Open questions for Maxi

1. **ViteHub version per fixture.**
   - At M's pin (`1e807fc9`), the bugs live in the primitives: per-put `access`, the `{ id }` enqueue option, schedules with no leases across instances.
   - On `main`, they live only in app code, and M must be refreshed (`runQueue` → `sendQueue`, explicit serve access).
   - Two pins, or one?
2. **M's comments** hand the agent the fix. Strip all of them in the A/B fixture copy?
3. **Cloudflare-only cases** (DB4, QW5): is vite dev with `host: 'cloudflare'` (D1 and queue limits) enough, or do you want a workerd check on Slimbook?
4. **Tooling.** Is "no skills" in A only the bare setup, or do we also run B/C to measure what the Nuxt MCP and skills add on fixes? Primitive use depends on finding ViteHub docs, and web access is open.
5. **The "Vue portal" issue:** is it #4054, the Vue/Nuxt session store, or #4044, the per-page session read with the 6× req/s?
6. **One report per case, or 2–3 phrasings** to measure robustness?
7. **Novel fixes:** do you label them, and do they join the corpus as new solution rows?
8. **A possible bug in M itself:** `cover.put.ts` reads `event.req.formData()` before `ensureBlob`, which may buffer any size. Check before M becomes the oracle (BL4).
9. **Doc drift:** the NuxtHub migration doc still says fs-lite ignores `ttl` (fixed in `ae217627b4`). Fix it upstream as part of this work?
