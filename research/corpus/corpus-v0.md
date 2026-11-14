# Fix and hidden-bug corpus v0

Merged on 2026-11-14 from the four council files in this folder: `council-opus.md` (ViteHub history), `council-sol.md` (ecosystem and migrations), `council-grok.md` (hidden bugs; written by Opus in Grok's seat), `council-fable.md` (eval design, perf, change tasks). About 160 seat cases became 115 canonical cases, 9 plant-only ids and 21 decoys. 6 seat cases were cut.

Versions. "Pin" means the ViteHub commit the Meetups reference installs, `1e807fc9` (2026-11-08), read with `git show 1e807fc9:<path>` in `/home/maxi/vitehub/vitehub`. "Main" means `origin/main` on 2026-11-14. Nuxt, Nitro and ocache facts come from the versions the reference pins, installed in `/home/maxi/vitehub/nuxt-evals/node_modules/.pnpm`: `nuxt-nightly@5.0.0-2611070044-e3875e8`, `nitro@3.0.261103-rc`, `ocache@0.3.1`, `h3@2.0.8`. Many ViteHub fixes the seats cite landed after the pin. Each case says which side of the pin it assumes.

Tags. `verified (path:line)` means I read it during this merge. Seat tags ([V], [R], [G]) are kept where I did not recheck.

## 1. Counts

115 canonical cases from about 160 seat cases; 6 seat cases cut (section 9). Type: 65 both, 35 A (one a control), 7 B (one a diff review), 8 C.

| Family | Cases | | Class | Cases | | Evidence | Cases | | Fixture | Cases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q | 17 | | perf | 26 | | real | 76 | | M | 66 |
| MG | 15 | | security | 26 | | synthetic | 39 | | M+ | 13 |
| DB | 13 | | bug | 22 | | | | | L | 11 |
| AU | 12 | | migration | 15 | | | | | J | 7 |
| SSR | 11 | | nook | 14 | | | | | M-cf | 5 |
| CH | 10 | | feature | 5 | | | | | V | 5 |
| BL | 9 | | dx | 2 | | | | | EL | 4 |
| SEC | 9 | | not-a-bug | 2 | | | | | ST | 2 |
| KV | 8 | | refactor | 1 | | | | | M + DR | 1 |
| PF | 4 | | tests | 1 | | | | | M+ + DR | 1 |
| RL | 3 | | review | 1 | | | | | | |
| EN | 2 | | | | | | | | | |
| RT | 1 | | | | | | | | | |
| AG | 1 | | | | | | | | | |

Hidden-bug pool: 71 plants that are fix cases (kept under their case ids) plus 9 plant-only ids (HB1-HB9), so 80 plants; 21 decoys (DC1-DC21) plus the clean-base control DC0. Drop (DR) is the second fixture for Q9, DB3 and PF1.

Fixture codes:
- **M**: the Meetups reference (`tasks/meetups/reference`), comments stripped, one plant per run.
- **M+**: M plus a small feature that hosts the plant (tickets, invite codes, comments, recordings, a webhook).
- **M-cf**: M built with `preset: 'cloudflare'` (the pin's option, verified at pin `packages/vite-hub/src/index.ts:358`; main calls it `host`). Vite dev applies D1 and Queue limits; Miniflare for runtime.
- **L**: Meetups-legacy, M rewritten as Nuxt 3, NuxtHub 0.7/0.10 and h3 v1 code. Its target is M.
- **J**: a new jobs fixture (about 800 lines): webhook intake, Queue, Workflow, KV/DB job state, Email, a Schedule sweeper.
- **EL**: email-labeller at the parent of a real fix commit.
- **DR**: Drop at the parent of a real fix commit; the fix's own tests are the hidden tests.
- **ST**: the nuxt-evals `site/` at a past commit.
- **V**: a small new viewer or notes app (Console/Drop shape).

## 2. Why these bugs get written

Opus's six patterns and Fable's W1-W12, merged. Every case carries one or two tags.

| Id | Cause | What makes it easy |
| --- | --- | --- |
| W1 | Local hides remote | One process and sub-millisecond SQLite in dev. Production is D1 or Turso at tens of ms per round trip, on many isolates. N+1, serial awaits and in-memory locks cost nothing locally. |
| W2 | Dev defaults and host limits differ | Mail stays in the outbox, the limiter is in memory, the local queue has no payload cap and no cross-process lock. D1 binds 100 parameters, Cloudflare Queues take 128 KB and refuse `idempotencyKey`, Cloudflare KV has no atomic write. None of it shows on Node. |
| W3 | Two runtimes, one file | A Vue file runs on the server and in the browser. Module scope on the server is shared by every request. Clock, zone and cookies differ between the two renders. |
| W4 | Errors as values | ViteHub helpers return `[error, value]` and do not throw. An `await` without a destructure looks fine, and a tuple is always truthy. |
| W5 | Check, await, act | Every `await` yields. Read, decide, write without one atomic statement or a constraint races even on one Node process. D1 has no interactive transactions to hide it in. |
| W6 | At-least-once delivery | Jobs, ticks, workflow steps and webhooks run again. The inline dev providers never replay, so a handler that is unsafe to repeat looks correct. |
| W7 | The short form over-fetches or runs everywhere | `db.select()` with no columns, `useFetch` copying the whole response, a global plugin or middleware on every route, a static import in a shared file, one `useFetch` per leaf component. |
| W8 | API drift | Nuxt 3 to 5, h3 v1 to v2, Nitro 2 to 3, NuxtHub to ViteHub, ViteHub's weekly renames. Models write the API they remember. |
| W9 | Trust boundaries are per file | File routes have no default deny, so each route repeats its guard. Request input (Host, X-Forwarded-For, body ids, client paths) gets trusted like config. |
| W10 | Cache as a speed patch | A cache added to fix a slow page keeps whatever it closed over: one user's data, one query's result, stale seats. |
| W11 | The schema lives in three places | The Drizzle schema, the migration files and the production database drift when one is edited alone. Auth plugins add a fourth owner. |
| W12 | Names that read like guarantees | `authorize: true`, `access: 'private'`, `types: ['image']`, `idempotencyKey`, `auth: true`, Nuxt's own "use `external: true`" fix text. Each sounds safer than it is. |

## 3. Design

### Scoring for Type A (fix)

A gate comes first and is reported as its own rate: the hidden fail-to-pass tests pass, the pass-to-pass suite (M's probes) stays green, and the app builds. A run that fails the gate gets 0 quality; its time and cost are still reported. Data loss or a new authorization hole fails the gate.

| Dimension | Weight | How |
| --- | --- | --- |
| Solution class | 30 | best 1, acceptable 0.75, over-engineered 0.4, masks-symptom 0.1 (only reachable if it passes the gate), wrong 0 |
| Root cause | 20 | half deterministic (the diff changes the planted region), half judge on the final message (exact mechanism / cause without mechanism / symptom only) |
| Primitive use | 15 | a static probe for the best fix's API (`chunkParameters`, `setIfAbsent`, `blob.serve`, `defineCachedFunction`…) or a stated reason not to use it. Supported direct SQL is not a penalty. |
| Footprint | 15 | Fable's ratio: `max(lines/best_lines, files/best_files)`, full marks to 1.5×, 0 at 6×; minus 0.3 per new dependency no ranked solution has, 0.3 per ViteHub package no best/acceptable fix uses, 0.2 for edits away from the cause. Tests, lockfile and generated snapshots don't count. |
| No collateral | 10 | Vite Doctor delta, typecheck, unrelated behaviour |
| Own verification | 10 | the agent reproduced the report first, or left a test that fails on the plant |

Time, tokens, cost and "turns until the planted file was opened" sit beside the score, with cost per accepted fix (total cost / runs that pass the gate as best or acceptable).

### Scoring for Type B (hidden)

| Dimension | Weight | How |
| --- | --- | --- |
| Severity-weighted recall | 40 | critical 4, high 3, medium 2, low 1; matched weight / planted weight |
| Precision | 25 | decoy hit −2, speculative or false finding −1, style nit −0.25; past 25 findings ignored |
| Explanation | 20 | per matched plant: mechanism, trigger, fix direction, 0-2 each |
| Severity order | 15 | Kendall τ over matched plants, plus severity within one tier of the manifest |

The prompt asks for `findings.json` (`file, line, severity, title, explanation`, at most 25, most severe first). It never gives the count. A real unplanted finding is neutral: a human confirms it, it joins the manifest, and the base gets fixed. Every agent also runs on the clean base (DC0); its findings there are its false-positive floor. Report recall twice: all plants, and Doctor-blind plants only.

### Solution matching

Cheapest first.
1. **Hidden tests** decide "works". Each case has a reproduction test plus discriminators built for its tempting masks: two server processes catch an in-memory lock; "seats fresh after an RSVP" catches a cached list; OG tags in SSR HTML catch `lazy: true`.
2. **Fingerprints**, no model: emitted SQL, counts of queries, round-trip waves, jobs, upstream hits and requests; new dependencies, tables and ViteHub keys; AST marks such as a `setTimeout` retry loop or a `Map` lock; whether the diff touches the planted lines.
3. **Judge**: Opus reads the diff and the case's ranked entries in shuffled order, picks one or says "novel", and quotes diff lines. Run it twice; on disagreement or "novel", Maxi labels it and the corpus grows by one row. Track the novel rate per case.

B matching: a finding is a candidate for a plant when it names the plant's file and a line within ±10 (or the same function, or a second file the manifest lists). The judge confirms the mechanism against the manifest's one-line cause. One finding matches one plant.

### Fixture strategy

- **M for most A cases** (about 60 of 115). It scores 10, seeds data, uses nine primitives, and its comments name the bug each choice avoids, so many plants are "invert the code, strip the comment". Seed large for perf cases (20,000 events, 200,000 RSVPs).
- **L** for migrations; M is its best answer and its rubric already exists.
- **J** for Workflow and job-state nooks (wave 2; about a day to build).
- **Real repos at a fix's parent** (EL, DR, ST) when the fix has its own test. Drop (50,600 lines) is the large-app arm.
- **No synthetic huge app for A.** One plant per run keeps the score attributable. The same plant in M and in Drop measures what size costs.
- **B** starts on M with 12 plants and 12 decoys (section 7). Grow to "Meetups Hidden" (M plus five plant-hosting features, a 30-plant pool, seeded draws) only after the first runs are read.
- **Pin** M at `1e807fc9` for wave 1. Verify with HTTP probes, a mail stub, a rates stub, a counting libSQL proxy and `vitehub schedule run`. Main's `vite-hub/test` (`setupViteHubTest`, `hub.emails`, `hub.runSchedule`) came in `d6081c9db7` after the pin (verified: `git merge-base --is-ancestor` fails), so Opus's verifications that use it need the HTTP form at the pin.

### Admission and leak controls

A case enters the suite after five scripted checks (Fable's list, plus Opus's rerun rule):
1. The base passes every hidden test.
2. The plant fails the fail-to-pass tests 5 times out of 5.
3. Every best and acceptable patch passes everything; every masks-symptom and wrong patch fails at least one discriminator, or the case says it falls to fingerprint or judge.
4. A second correct fix in another style passes.
5. The ranking of best, mask and wrong patches holds over 3 judge reruns.

Leaks:
- Strip every comment that explains a hardening choice, in plants and clean code alike.
- One fresh commit per fixture: no history, no `.orig`, no reflog, neutral folder names, no case id anywhere.
- Ship a normal visible test suite; keep fail-to-pass tests hidden.
- Generate plant variants from a seed (handler, names, seed data) so one leak doesn't solve the next.
- Keep a held-out set for the headline; skills may be tuned on the dev set only. No case name, file name or report phrase in any skill under test.
- Audit transcripts: fail a run that fetched the reference (the site's Workspace), `vite-hub/drop`, or the fix commit.

### Where the seats disagree, and my call

| Topic | Seats | Recommendation | Why |
| --- | --- | --- | --- |
| A weights | Opus root 25 / class 25; Grok the same with minimality 15; Fable class 30 / root 20; Sol puts 25 on "works" and 10 on time/tokens/cost | Class 30, root 20, primitive 15, footprint 15, collateral 10, verification 10; "works" is the gate | The gate already carries "works"; a scored "works" double-counts it. Class is what Maxi asked for first (smart fix vs over-engineered). |
| Acceptable multiplier | 0.7 (Opus, Grok), 0.75 (Fable), 0.8 (Sol) | 0.75 | The middle; the gap to best should be visible but small. |
| Masks-symptom | 0.1 (Opus, Grok, Fable), 0 (Sol) | 0.1, only if it passes the gate | Discriminators should fail most masks; the few that pass still did something. |
| Time, tokens, cost | beside (Opus, Grok, Fable), 10% inside (Sol) | beside, plus cost per accepted fix | Findings v6 option 3; inside the score they blur quality across models. |
| B weights | precision 25 (Opus, Grok) vs 30 (Sol, Fable); explanation 20 vs 15; severity 15 vs 10 | 40 / 25 / 20 / 15 | Three seats give explanation 20 and severity 15; precision takes the rest. |
| Huge app vs several fixtures | Grok: one large "Meetups Hidden" for B; Opus, Sol, Fable: no huge app, small fixtures | M, L, J and real-repo parents for A; Drop as the real large app; Meetups Hidden later for B only | Search cost swamps fix quality in a huge synthetic app; Drop gives size with real tests for free. |
| Web access | Grok: off for B; Fable: off for A and B, or renamed fixtures plus audit; Opus: open; Sol: B reads only the repo | B off. A on, with the transcript audit failing runs that fetch the reference, Drop or the fix commit | A needs vitehub.dev docs to find the right primitive, which is part of the score. B is a reading test. |
| Vite Doctor in B | Grok: allow, report without Doctor-visible plants; Fable: split recall by linter visibility; Sol: read files only | Allow Doctor and `tsc`; headline recall on Doctor-blind plants | It is static and real users have it. The split shows whether the agent reads code or runs tools. |
| Judge vs hidden tests | all: tests decide "works"; Grok and Fable add fingerprints; Sol wants a blinded judge | tests, then fingerprints, then a blinded judge run twice, then Maxi for novel | Fingerprints settle most runs with no model and cut judge variance. |
| Pin | Opus: two pins?; Sol: freeze one tuple; Fable: keep pin or move; Grok: pin | One pin (`1e807fc9`) for wave 1; MG9 is the bridge; rebase M to a main pin in wave 2 after regrading it | The reference is graded at the pin. Moving it means regrading and refreshing `runQueue` and Blob serve access first. |
| Real unplanted findings in B | Opus, Grok: neutral; Sol: investigate and version the benchmark | Neutral, confirmed by a human, added to the manifest | A bonus makes scores depend on how complete our manifest is. |
| Comments in fixtures | all: strip | Strip all hardening comments | M's comments name the bug. |

### Fact disagreements, resolved against source

| Fact | Seats | Resolution |
| --- | --- | --- |
| `runQueue`'s return shape | Sol: a direct acknowledgement, so M's `[error]` destructure may be wrong | Refuted for the pin: `runQueue` returns `Promise<Result<QueueSendResult, QueueErrorCode>>` (pin `packages/queue/src/runtime/client.ts:161`). Sol read an October checkout. |
| Lazy Better Auth client | Sol: `packages/auth/src/vue.ts:1` imports eagerly | Refuted for the pin: #2692 merged 2026-10-22, before the pin; M imports `createAuthClient` from `vite-hub/auth/vue` (`app/utils/auth-client.ts:2`). |
| Atomic KV drivers | Opus: database, redis, upstash, deno-kv, fs-lite | At the pin only Upstash, Deno KV and fs-lite (`packages/kv/src/types.ts:4,142`; `runtime/driver.ts:29-32`), and fs-lite ignores `ttl` (`types.ts:105`). |
| `checkRateLimit` result | Opus: a tuple | Main only (`43128a213e`). At the pin, `Promise<RateLimitDecision>` (`guard.ts:135`). Both are truthy, so RL1 holds. |
| Cached handler leak | Opus: `defineCachedEventHandler` plus `requireUser` leaks | Refuted: Nitro 3 exports `defineCachedHandler` and strips cookies by default (`nitro/dist/runtime/cache.d.mts:1-2`; `ocache/dist/index.d.mts:445-449`). KV5 uses a cached function instead. |
| `setIfAbsent` as a sync lock | Opus: acceptable; Grok: wrong | Both, per host: wrong on Cloudflare KV, acceptable on Upstash/Deno KV (Q8). |
| Test harness | Opus: `setupViteHubTest`, `hub.emails`, `hub.runSchedule` | Main only (`d6081c9db7`, after the pin). Wave 1 verifies over HTTP with stubs. |
| Workflow verb | Opus: `startWorkflow` | Main naming; the pin exports `runWorkflow` (pin `packages/workflow/src/index.ts`). |
| Host option | Opus: `host: 'cloudflare'` | The pin's option is `preset` (pin `packages/vite-hub/src/index.ts:358`). |
| 30-day cache eviction | Grok: `setTimeout` overflow evicts at once | Refuted at the pin: ocache chains timers (`ocache/dist/index.mjs:302-308`). Cut. |
| One pending call per key | Fable: unchecked | Verified: ocache dedupes in-flight calls per key (`ocache/dist/index.mjs:494-611`). |
| "Vue portal" | Opus: #4054 (or #4044); Grok: #2692; Sol: Drop `f949cdb7` / #2692; Fable: #4001, #4044, #2692 | #4054 (see AU1, claim f). |
| M buffers uploads | Opus and Fable: a guess | Verified (claim g, BL4). |

## 4. Index

Evidence: **real** means the bug happened in a real repo, issue or graded agent run (the case still plants it); **synthetic** means a designed plant. A/B/both/C is in each case.

| Id | Title | Class | Primitive | Fixture | Diff | Evidence | W | From |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q1 | A failed send is logged and the job succeeds | nook | Email, Queue | M | 2 | real | W4 | opus QW1 · fable N-01 |
| Q2 | A retried job sends the email again | bug | Queue, Email, Database | M | 3 | real | W6, W12 | opus QW2 · sol SOL-33 · grok C04 |
| Q3 | Reminders arrive twice, or never | nook | Schedule, Queue, Database | M | 3 | real | W6, W5 | opus QW3 · grok C05 |
| Q4 | Two clicks start two workflow runs | nook | Workflow, Database, Email | J | 3 | real | W6, W1 | opus QW4 |
| Q5 | A workflow retry repeats a finished side effect | bug | Workflow, Queue | J | 4 | synthetic | W6, W12 | sol SOL-34 |
| Q6 | A job payload over Cloudflare's 128 KB | nook | Queue, Blob | M-cf | 2 | real | W2 | opus QW5 |
| Q7 | One poison message stops the inbox | bug | Schedule, KV | EL | 3 | real | W6 | opus QW6 · sol SOL-38 |
| Q8 | A module-level lock that doesn't lock | bug | Database, Schedule | EL | 3 | real | W1, W5 | opus QW7 · grok C07 |
| Q9 | A dead worker's claim never expires | bug | Queue, Database, Schedule | J | 3 | real | W6, W5 | opus QW8 · fable D-02 |
| Q10 | A late progress update overwrites "completed" | bug | KV, Workflow | J | 3 | real | W5, W6 | opus QW9 |
| Q11 | A notification sent from a GET | bug | Email, Workflow | J | 3 | real | W6, W5 | opus QW10 |
| Q12 | A dedupe key that hashes volatile fields | perf | Database, Schedule | J | 3 | real | W6 | opus QW11 |
| Q13 | The RSVP waits for the mail provider | perf | Queue, Email | M | 3 | synthetic | W1, W6 | sol SOL-32 |
| Q14 | Push watch started before the cursor | bug | KV, Schedule | EL | 4 | real | W5 | sol SOL-37 |
| Q15 | The reminder tick outlasts its interval | perf | Schedule, Queue, Database | M | 3 | synthetic | W1, W7 | fable P-11 |
| Q16 | `idempotencyKey` refused on Cloudflare | nook | Queue | M-cf | 4 | real | W2, W4 | grok N01 |
| Q17 | `schedule: true` fails the Node build | dx | Schedule | M | 1 | synthetic | W2 | fable N-03 |
| BL1 | The served store publishes private files | security | Blob, Auth | M+ | 3 | real | W12, W9 | opus BL1 · grok S10 |
| BL2 | An uploaded SVG runs script | security | Blob | M | 2 | real | W12 | opus BL2 · grok S09 |
| BL3 | The recording won't seek | bug | Blob | M+ | 2 | real | W1 | opus BL3 |
| BL4 | The upload buffers the body before the size check | security | Blob, h3 | M | 3 | real | W7 | opus BL4 · fable S-02 |
| BL5 | The new cover never shows | bug | Blob | M | 2 | real | W10 | opus BL5 |
| BL6 | Cards download full-size covers | perf | Blob | M | 2 | synthetic | W7 | fable P-07 |
| BL7 | A blanket `no-store` re-downloads every cover | perf | Blob, route rules | M | 2 | real | W10 | fable P-08 |
| BL8 | The upload trusts the client's path | security | Blob, Auth | M | 3 | synthetic | W9 | sol SOL-28 |
| BL9 | An R2 binding can't presign | nook | Blob | M-cf | 3 | synthetic | W2 | sol SOL-29 |
| AU1 | Signed-in pages read the session once per component ("Vue portal") | perf | Auth | M | 3 | real | W7, W3 | opus AU1 · sol SOL-12 · grok P07 |
| AU2 | Better Auth's client in every page's entry chunk | perf | Auth | V | 3 | real | W7 | sol SOL-11 · grok P07 |
| AU3 | A global middleware reads the session on every request | perf | Auth | M | 3 | real | W7 | opus AU2 · grok P06 |
| AU4 | A path-compare guard misses `/export/` | security | Auth, routing | M+ | 3 | real | W9 | opus AU4 |
| AU5 | Reset links built from the Host header | security | Auth, Email | M | 2 | real | W9 | opus AU5 · grok S17 |
| AU6 | The sign-up hook trusts the email | security | Auth | ST | 3 | real | W9 | opus AU6 |
| AU7 | Signed in is treated as owner | security | Auth, Database | M | 1 | real | W9 | opus NX3 · grok S01 · grok S02 |
| AU8 | The body picks the event | security | Auth, Database | M+ | 2 | synthetic | W9 | grok S19 |
| AU9 | The CSRF and origin checks turned off | security | Auth | M | 3 | real | W12, W9 | grok S12 |
| AU10 | A removed privilege lives on in the cookie cache | security | Auth | M+ | 4 | real | W10 | sol SOL-13 |
| AU11 | The header says "Sign in" in the server HTML | nook | Auth | M | 3 | real | W3 | grok N03 |
| AU12 | Forgot-password timing tells who has an account | security | Auth, Email | M | 3 | synthetic | W1 | fable S-01 |
| DB1 | Seats left goes negative | bug | Database | M | 3 | real | W5, W1 | opus DB1 · sol SOL-35 · grok C01 |
| DB2 | One seat-count query per event | perf | Database | M | 2 | real | W1, W7 | opus DB2 · sol SOL-36 · grok P01 |
| DB3 | Independent reads wait in line | perf | Database | M, DR | 2 | real | W1 | opus DB3 · grok P05 · fable P-09 · fable D-01 |
| DB4 | D1's 100 bound parameters | nook | Database (D1) | M-cf | 3 | real | W2 | opus DB4 · grok P11 |
| DB5 | A generated migration cascades on D1 | bug | Database, Auth | ST | 4 | real | W11 | opus DB5 · sol SOL-25 |
| DB6 | Lowering capacity below the people going | bug | Database | M | 3 | real | W5 | grok C02 |
| DB7 | Comment numbers from read-then-insert | bug | Database | M+ | 2 | real | W5 | grok C06 |
| DB8 | Pagination done in JavaScript | perf | Database | M | 2 | real | W1, W7 | grok P02 |
| DB9 | `lower(city)` defeats the index | perf | Database | M | 2 | real | W1 | grok P03 |
| DB10 | A missing index, fixed without a migration | perf | Database | M+ | 3 | real | W11 | fable P-10 |
| DB11 | Someone edited a migration production applied | bug | Database | M | 3 | real | W11 | fable M-02 |
| DB12 | The deploy skips the migrations | bug | Database | L | 3 | real | W11, W2 | sol SOL-26 |
| DB13 | The list ships every column | perf | Database | M | 2 | synthetic | W7 | fable P-01 · sol SOL-07 |
| KV1 | A single-use code works twice | nook | KV | M+ | 2 | real | W5, W2 | opus KV1 · grok C08 |
| KV2 | The paid upstream is called per request | perf | Nitro cache | M | 2 | real | W1 | opus KV2 · grok P04 |
| KV3 | A hand-rolled rates cache stampedes | perf | Nitro cache, KV | M | 3 | synthetic | W5, W2 | fable P-05 · opus KV2 variant · sol SOL-23 |
| KV4 | A memoized promise keeps its rejection | bug | none | M | 2 | real | W10 | opus KV3 |
| KV5 | A cache shows one user's data to another | security | Nitro cache, Auth | M | 3 | real | W10 | opus AU3 · grok S06 · sol SOL-14 |
| KV6 | A cached handler ignores the query | nook | Nitro cache | M | 3 | real | W8, W10 | grok P08 |
| KV7 | A search cache that never forgets | perf | Nitro cache | M | 2 | synthetic | W10 | fable P-12 |
| KV8 | An activity feed kept in one KV value | perf | KV | M+ | 3 | synthetic | W5, W7 | fable P-13 |
| RL1 | The rate limit never trips | nook | Rate-limit | M | 1 | real | W4, W12 | opus RL1 · fable N-02 |
| RL2 | Behind a proxy, everyone is one client | nook | Rate-limit, Auth | M | 3 | real | W2, W9 | opus RL2 |
| RL3 | The limit is keyed on a spoofable header | security | Rate-limit | M | 2 | real | W9 | grok S14 |
| RT1 | Signed in can write any document | security | Realtime | V | 3 | real | W12 | opus RT1 |
| AG1 | A child hook replaces the preset's hook | nook | Agent | EL | 3 | real | W12 | opus AG1 · grok N02 |
| EN1 | A sealed secret is sent as redacted text | nook | Env | M | 2 | real | W12 | opus EN1 |
| EN2 | The API key ships to the browser | security | Env, runtimeConfig | M | 1 | real | W3 | opus NX5 · grok S04 |
| PF1 | A heavy library in every route's chunk | perf | Nuxt build | M+, DR | 2 | real | W7 | fable P-02 · fable D-03 |
| PF2 | The server takes ten seconds to boot | perf | Nitro plugins | M | 3 | synthetic | W1 | fable P-03 |
| PF3 | A CSV export freezes the site | perf | h3 | M | 3 | synthetic | W1 | fable P-04 |
| PF4 | Every card polls once a second | perf | Nuxt | M | 2 | synthetic | W7 | fable P-06 |
| SSR1 | Request data in module scope | security | Nuxt state, h3 | M | 2 | real | W3 | opus NX1 · sol SOL-08 · grok S05 |
| SSR2 | Times render differently on server and client | bug | Nuxt SSR | M | 2 | real | W3 | opus NX2 · sol SOL-09 · grok T02 |
| SSR3 | The venue time is read in the server's zone | bug | none | M | 3 | real | W1, W3 | grok T01 |
| SSR4 | The SSR fetch drops the session cookie | bug | Nuxt fetch, Auth | M | 2 | real | W3 | sol SOL-01 |
| SSR5 | A setup `$fetch` runs twice | perf | Nuxt payload | M | 1 | synthetic | W3 | sol SOL-02 |
| SSR6 | Two cards share one async-data key | bug | Nuxt data | M | 2 | synthetic | W12 | sol SOL-03 |
| SSR7 | A manual watcher doubles every filter request | perf | Nuxt data | M | 2 | synthetic | W7 | sol SOL-04 |
| SSR8 | An older search result wins | bug | Nuxt data | M | 4 | real | W5 | sol SOL-05 |
| SSR9 | Search fires a request per keystroke | perf | Nuxt data | M | 1 | real | W7 | grok P10 |
| SSR10 | A watcher outlives its component | perf | Vue | V | 4 | real | W3 | sol SOL-10 |
| SSR11 | Two Vue runtimes break UI slots | dx | Vue, UI | V | 4 | real | W8 | sol SOL-40 |
| SEC1 | Mass assignment through a body spread | security | Database, h3 | M | 1 | real | W9, W7 | opus NX4 · grok S03 |
| SEC2 | Open redirect through `external: true` | security | Nuxt router | M | 2 | real | W12 | grok S07 · opus B-only 2 |
| SEC3 | Stored XSS through `v-html` | security | Vue | M+ | 2 | real | W7 | grok S08 · opus B-only 3 |
| SEC4 | The cancel link is a state-changing GET | security | h3 | M+ | 3 | real | W12 | grok S11 |
| SEC5 | The sort parameter goes through `sql.raw` | security | Database | M | 2 | synthetic | W12 | grok S13 |
| SEC6 | Database errors sent to the browser | security | h3 | M | 2 | synthetic | W7 | grok S15 |
| SEC7 | Attendee emails in the public event payload | security | Database | M | 2 | real | W7 | grok S16 |
| SEC8 | The CSV export runs formulas | security | none | M | 1 | real | W9 | grok S18 · opus B-only 1 |
| SEC9 | The payment webhook is unsigned | security | h3 | M+ | 3 | real | W9 | grok S20 |
| MG1 | Move a NuxtHub app to ViteHub | migration | Database, KV, Blob, Cache | L | 4 | real | W8, W4 | opus MG1 · grok M01 · sol SOL-24 |
| MG2 | Migrated KV calls use the tuple as the value | migration | KV | L | 2 | synthetic | W4, W8 | sol SOL-27 |
| MG3 | Old h3 v1 server code on Nuxt 5 | migration | h3, Nitro | L | 3 | synthetic | W8 | opus MG2 · grok M02 · sol SOL-20 |
| MG4 | The redirect runs the mutation under it | migration | h3 | L | 2 | synthetic | W8 | sol SOL-16 |
| MG5 | Middleware that protected a prefix now matches one path | migration | h3 | L | 3 | synthetic | W8, W9 | sol SOL-17 |
| MG6 | The webhook signature is checked on re-serialized JSON | migration | h3 | J | 4 | real | W8 | sol SOL-18 |
| MG7 | A proxy drops the second Set-Cookie | migration | h3 | V | 3 | synthetic | W8 | sol SOL-19 |
| MG8 | The TypeScript config no longer loads | migration | Nuxt config | L | 3 | synthetic | W8 | sol SOL-21 |
| MG9 | Bump ViteHub across breaking renames | migration | Queue, Blob, codemods | M | 3 | real | W8 | opus MG3 · fable M-01 |
| MG10 | Every deploy wipes all events | migration | Database, Env | L | 2 | real | W8, W2 | opus MG4 |
| MG11 | Timers and `waitUntil` to Schedule and Queue | migration | Schedule, Queue | L | 3 | real | W2, W6 | grok M03 · sol SOL-31 |
| MG12 | Port the reference to Cloudflare | migration | Queue, KV, Database, Schedule | M-cf | 4 | real | W2 | grok M04 |
| MG13 | Shallow refs break an old inline editor | migration | Nuxt data | L | 3 | synthetic | W8 | sol SOL-06 |
| MG14 | Hand-written upload checks to Blob helpers | migration | Blob | M | 2 | synthetic | W8 | fable M-03 |
| MG15 | A home-made session service to ViteHub Auth | migration | Auth, Database | L | 5 | synthetic | W8, W9 | sol SOL-30 |
| CH1 | Add a waitlist | feature | Database, Queue, Email | M | 4 | synthetic | W5, W6 | fable T-01 |
| CH2 | Add co-organizers | feature | Auth, Database | M | 3 | synthetic | W9 | fable T-02 |
| CH3 | Delete an event | feature | Database, Blob, Queue | M | 2 | synthetic | W9, W11 | fable T-03 |
| CH4 | Add a currency | feature | none | M | 1 | synthetic | W7 | fable T-04 |
| CH5 | Add passkey sign-in | feature | Auth, Database | M | 4 | synthetic | W8, W11 | fable T-05 |
| CH6 | Refactor the mail code without changing it | refactor | Email, Queue | M | 2 | synthetic | W6 | fable T-06 |
| CH7 | Write tests, scored by the plants they catch | tests | Database, Queue, Email | M | 3 | synthetic | W1 | fable T-07 |
| CH8 | Review a pull request | review | several | M+ | 3 | real | W5, W9 | fable T-08 |
| CH9 | "Can a guest get two reminders?" | not-a-bug | Queue, Schedule | M | 2 | synthetic | W6 | fable T-09 |
| CH10 | "Emails don't arrive on my machine" | not-a-bug | Email | M | 2 | synthetic | W2 | fable N-04 |

## 5. Cases

Shape: BRIEF.md's case shape plus `Why` tags and `From`. Line numbers in M are the reference as it stands (comments included).

### Queue, Workflow, Schedule (Q)

### Q1 A failed send is logged and the job succeeds
- Type: both · Class: nook · Primitive: Email, Queue · Why: W4
- Fixture: M, `server/utils/mail.ts:63-68`. Drop the claim release and `throw error`, keep the `console.error`. Variant: a bare `await email.send(…)`. 2-6 lines.
- Report: "Resend was down for ten minutes on Tuesday. Nobody who RSVPed then got a confirmation, and nothing retried."
- Root cause: `email.send()` returns `[error, data]` and does not throw (pin `packages/email/src/types.ts:171`). The job resolves, the Queue acks it, and the sent-at claim stays set, so no retry sends.
- Why it gets written: every other mail client throws, and logging looks like handling. The Queue docs say a throwing handler is retried, so authors assume errors propagate. Doctor VHUB0003 catches the bare form but accepts `const [error] = …` that only logs.
- Verification: a mail stub that fails twice then accepts gives exactly 1 mail and `confirmation_sent_at` set. An always-failing stub leaves the job dead after 4 attempts (pin `packages/queue/src/providers/local.ts:155`, per Fable) and the column null. Running the job twice still sends 1.
- Solutions:
  - [best] release the claim and rethrow, so the Queue retries (M `mail.ts:63-68`)
  - [acceptable] mark sent only after a successful send · retries work; a crash between send and mark sends twice (Q2)
  - [over-engineered] an outbox table swept by a Schedule, or a Workflow step for one send
  - [masks-symptom] `try/catch` plus a log, or a `setTimeout` retry inside the handler
  - [wrong] rethrow without releasing the claim · the retry finds the claim and returns
- Traps: `try/catch` (nothing throws); fixes the throw and forgets the claim; debugs the Resend config.
- Evidence: real. ViteHub `2ea9501659` (#2579, tuples, before the pin), Doctor rules `49f1002aaa` (#3168, before the pin); nuxt-evals `38f825d` added the "send() errors" check. M is the best fix.
- Difficulty: 2 · Static-detectable: yes (Doctor sees the bare variant only)
- From: opus QW1 · fable N-01

### Q2 A retried job sends the email again
- Type: both · Class: bug · Primitive: Queue, Email, Database · Why: W6, W12
- Fixture: M, `mail.ts:27-30`. Remove the conditional `update … where sent is null returning` claim; send first, then set the column. The mail stub times out after accepting once. About 10 lines.
- Report: "Some attendees got the 'you're going' email two or three times."
- Root cause: delivery is at least once and the handler sends before it records. A provider answer lost after acceptance, or a restart before the ack, sends again on the retry.
- Why it gets written: in dev each job runs once and succeeds. `idempotencyKey` on the enqueue reads like exactly-once, but it dedupes only pending or running jobs (pin `packages/queue/src/providers/local.ts:128-129`, per Grok), not attempts of one job.
- Verification: the stub accepts then times out; after the retry the stub holds exactly 1 mail per RSVP. Two parallel jobs for one RSVP also give 1. Re-running a completed job sends nothing.
- Solutions:
  - [best] claim the sent-at column in one conditional UPDATE … RETURNING before sending, release it on a provider error (M)
  - [acceptable] a unique `sent_emails(kind, rsvp_id)` row inserted before the send
  - [acceptable] a provider idempotency key on the send (`email.send({ idempotencyKey })`, pin `packages/email/src/types.ts:75`) · Resend only; the Cloudflare Email driver refuses it (pin `drivers/cloudflare-email.ts:152`)
  - [over-engineered] a Workflow with a send step · steps repeat too
  - [masks-symptom] `maxAttempts: 1` or retries off · duplicates stop, mail is lost
  - [wrong] add `idempotencyKey` to the enqueue only; a KV `get`/`set` "sent" flag (racy)
- Traps: the enqueue `idempotencyKey`, which is what the name suggests; a DB boolean set after the send.
- Evidence: real class: babysitter `2208a8287` and `1a773f605` (a redelivery re-ran a paid pass). M's design. Sol's crash-window note: no DB flag closes the "accepted but answer lost" window without a provider key; the claim plus release narrows it to that one window (see CH9).
- Difficulty: 3 · Static-detectable: partly
- From: opus QW2 · sol SOL-33 · grok C04

### Q3 Reminders arrive twice, or never
- Type: both · Class: nook · Primitive: Schedule, Queue, Database · Why: W6, W5
- Fixture: M, `server/schedules/event-reminders.ts`. Variant a (Opus): send inline in the loop with no per-RSVP claim and set `reminderSentAt` after the loop. Variant b (Grok): select events in `[now+24h, now+24h15m)` with no `reminderSentAt` filter and no key. Variant c: keep M, add a non-idempotent "notify organizer" job and run two replicas on one `.vitehub/data`. 6-15 lines.
- Report: "After the server restarted everybody got two reminders. Last week some people got none."
- Root cause: one occurrence can run more than once (catch-up after a restart, a host double wake, a manual run, two instances), and the tick is not idempotent per RSVP. A pure time window has no memory, so a missed tick skips its window. In variant c, the local queue has no lock between processes.
- Why it gets written: "cron fires once" and "every 15 minutes, events 24 h out" is how people describe jobs. The docs say a host can deliver a wake twice; once-per-occurrence across instances came in `2b08764c78` (#3861), after the pin.
- Verification: `vitehub schedule run event-reminders` twice for the same time, and two runs in parallel: one mail per due RSVP. Skip a tick: the next tick still sends. Variant c: two processes, 20 jobs, the webhook mock counts 20.
- Solutions:
  - [best] bound by `startsAt` in the next day, filter `reminderSentAt is null`, queue one job per RSVP with `idempotencyKey: event-reminder:<id>`, claim in the job (M `event-reminders.ts:16-31`)
  - [acceptable] inline sends with a per-RSVP claim · no per-mail retry, slower tick
  - [acceptable] variant c: one process per data folder, or a Postgres queue (main `6cc355d4a3`, after the pin)
  - [over-engineered] a lock on the whole tick (still repeats on catch-up), or a Workflow per RSVP sleeping until T−24 h
  - [masks-symptom] run one instance; widen the window
  - [wrong] dedupe with `runQueue(…, { id })` · ignored at the pin, removed by `a7e0b8e916` (#4248) after it
- Traps: locks the tick, not the RSVP; a KV flag; fixes duplicates and keeps the gap.
- Evidence: real. ViteHub `2b08764c78` (#3861), `5aee505fd6` (#2453, catch-up), `6908003fb1` (#3908); rubric N4; M is the best fix.
- Difficulty: 3 · Static-detectable: partly
- From: opus QW3 · grok C05

### Q4 Two clicks start two workflow runs
- Type: A · Class: nook · Primitive: Workflow, Database, Email · Why: W6, W1
- Fixture: J, `server/api/analyses.post.ts`: `runWorkflow('analyze', { repo, sha })` with no id; step 1 is a plain insert, step 3 sends mail. About 30 lines.
- Report: "If I click Analyze twice I get two reports and two emails. Once it happened with one click."
- Root cause: no run id, so each POST starts a run, and the steps are not idempotent, so a durable provider's replay repeats them. The inline dev provider never replays.
- Why it gets written: "start a workflow" reads like "enqueue once", and the dev provider makes unsafe steps look correct.
- Verification: two POSTs with the same repo and sha leave one run (`getWorkflowRun`) and one report row; replaying a step gives 1 row and 1 mail.
- Solutions:
  - [best] a stable run id (`{ id: \`analyze:${repo}@${sha}\` }`; pin `packages/workflow/src/types.ts:134`, inline dedupe since `ab096f3c8e` #2734, before the pin) plus an upsert in the step
  - [acceptable] a unique index with `onConflictDoNothing` in the step, no run id · rows dedupe, mail doesn't unless keyed
  - [over-engineered] a Queue with concurrency 1 in front of the workflow
  - [masks-symptom] disable the button
  - [wrong] a KV `get`/`set` flag
- Traps: a stable id on Vercel native workflows, which refuse `id` (main `workflows/server-api.md:37`, per Opus); uses main's `startWorkflow`, which the pin doesn't export (pin `packages/workflow/src/index.ts` exports `runWorkflow`).
- Evidence: real, `ab096f3c8e` (#2734).
- Difficulty: 3 · Static-detectable: partly
- From: opus QW4

### Q5 A workflow retry repeats a finished side effect
- Type: both · Class: bug · Primitive: Workflow, Queue · Why: W6, W12
- Fixture: J. A promise chain moved into one workflow handler with a single step around "create document, send welcome, analyze". 15-30 lines.
- Report: "If analysis fails near the end, retrying creates another document and sends the welcome message again."
- Root cause: the retried unit is larger than the side effect, and the external effects carry no stable key.
- Why it gets written: naming a function a workflow doesn't make each line exactly-once; providers differ in their step mechanisms.
- Verification: fail after document creation, restart the provider runtime, resume: one document, one welcome, final state completed, read through `getWorkflowRun`.
- Solutions:
  - [best] one step per side effect with the provider's step contract, plus stable keys on external effects
  - [acceptable] a small DB-backed state machine or outbox for the states
  - [over-engineered] queues nested around every pure computation
  - [wrong] an unlimited retry loop around the whole handler
- Traps: invents a universal `step.do` for every provider; trusts the workflow directive for external idempotency.
- Evidence: synthetic. Sol verified `defineWorkflow`, `runWorkflow`, `getWorkflowRun` and the README's idempotent-steps rule.
- Difficulty: 4 · Static-detectable: partly
- From: sol SOL-34

### Q6 A job payload over Cloudflare's 128 KB
- Type: both · Class: nook · Primitive: Queue, Blob · Why: W2
- Fixture: M-cf, `cover.put.ts`: a `make-thumbnails` job whose payload carries the base64 image. About 20 lines.
- Report: "Cover upload works on my laptop, but on the Cloudflare deploy the thumbnail never shows up."
- Root cause: the payload is over Cloudflare Queues' 128 KB of JSON. Local and Postgres providers have no limit.
- Why it gets written: local delivery accepts anything; only `f6467591bc` (#3440, before the pin) made vite dev apply the build host's limits.
- Verification: a spy on the enqueue sees a payload under 1 KB. Vite dev with `preset: 'cloudflare'` returns `QUEUE_PROVIDER_FAILED` before the fix.
- Solutions:
  - [best] `blob.put` first, enqueue the pathname
  - [acceptable] drop the job and resize on the serve route (`?w=`, as M does)
  - [over-engineered] split the payload across messages
  - [masks-symptom] compress the base64
  - [wrong] look for a limit setting
- Traps: fixes the thumbnail code; never connects the symptom to the host.
- Evidence: real, `f6467591bc` (#3440); the Queue limits table.
- Difficulty: 2 · Static-detectable: yes
- From: opus QW5

### Q7 One poison message stops the inbox
- Type: both · Class: bug · Primitive: Schedule, KV cursor · Why: W6
- Fixture: EL at `6efc348^` (real code), or J's `server/lib/sync.ts`: `await Promise.all(items.map(process))`, the cursor advances only after all succeed; one item always throws. 15-40 lines.
- Report: "Labelling stopped hours ago, but /api/health still says everything is fine."
- Root cause: a message that can never succeed fails the batch on every run, so the cursor never moves. Health checks only that the process is up.
- Why it gets written: "advance only after everything succeeds" is right until one item can never succeed; nothing dead-letters it.
- Verification: seed 10 items with #3 poisoned, plus a transient failure. After N runs the other 9 are processed, the transient one retried, #3 recorded as failed, the cursor skips no unrecorded work, and health is non-200 after 2 failed syncs without leaking details to anonymous callers.
- Solutions:
  - [best] per-item isolation (`Promise.allSettled`), a bounded attempt count, a recorded failed state, health that turns 503 (the real fix)
  - [acceptable] one Queue job per item; failed jobs go dead after 4 attempts
  - [acceptable] stop the batch but expose it with an operator retry path · only for manual-recovery requirements
  - [over-engineered] a separate retry service with backoff tiers
  - [masks-symptom] `try/catch` that drops the item silently
  - [wrong] advance the cursor before processing
- Traps: fixes only the oversized item; keeps health green; copies "3 attempts" as a universal rule.
- Evidence: real, email-labeller `6efc348851` (a 100 KB message over Executor's result limit).
- Difficulty: 3 · Static-detectable: partly
- From: opus QW6 · sol SOL-38

### Q8 A module-level lock that doesn't lock
- Type: both · Class: bug · Primitive: Database (D1 lease), Schedule · Why: W1, W5
- Fixture: EL at `2ddf40e^`: `let running: Promise | undefined` guards `sync()` in `server/lib/sync.ts:180-205` (real, 25 lines). Cron, push and manual syncs call it.
- Report: "Some emails get labelled twice and Gmail says we're over quota. It's only one cron!"
- Root cause: module state is per process or Worker isolate, so two isolates run `sync()` at once and race the cursor.
- Why it gets written: in-memory locks work in dev and on one Node process; nothing in Nitro says a Worker has many isolates.
- Verification: two app processes (or two Miniflare module instances) on one database and 10 concurrent triggers: each message processed once. The lease expires after a kill. A one-process test passes the mask, so the test must use two.
- Solutions:
  - [best] a DB lease: `update … set leaseUntil where leaseUntil is null or < now returning`, released only if still held (real fix `server/lib/sync-lease.ts`; joxi `9f1bd85` `reserveSync`)
  - [acceptable] on Node: `kv.setIfAbsent(key, owner, { ttl })` on Upstash or Deno KV · wrong on Cloudflare KV (claim e) and on fs-lite at the pin, where `ttl` never expires (pin `packages/kv/src/types.ts:105`)
  - [acceptable] a Durable Object or a Workflow singleton · more infrastructure
  - [over-engineered] an external lock service
  - [wrong] a KV `get`-then-`set` lock; a fancier in-memory mutex
- Traps: KV as a lock on Cloudflare; adds `await` ordering.
- Evidence: real, email-labeller `2ddf40e`; joxi `9f1bd85`.
- Claim (e) in context: verified, see KV1.
- Difficulty: 3 · Static-detectable: yes
- From: opus QW7 · grok C07 (Grok ranks `setIfAbsent` wrong, Opus acceptable; both are right per host, so the rank is per host)

### Q9 A dead worker's claim never expires
- Type: A · Class: bug · Primitive: Queue, Database, Schedule · Why: W6, W5
- Fixture: J: a job record set to `processing` at start; the test kills the worker. Large-app variant: DR at `983468e5^`, where a publish reserves quota and a dead Worker never releases it.
- Report: "The page has said 'Cloning…' for an hour." DR: "I can't publish, it says storage full, but my drops add up to half the plan."
- Root cause: a claim or reservation with no lease or expiry outlives the worker that took it.
- Why it gets written: the docs promise retries, so authors assume work always finishes or fails. A Worker can stop between any two awaits.
- Verification: J: a record with `updatedAt = now − ttl − 1s` becomes `failed` or is retried; a fresh one stays. DR: the fix's `test/quotas/reservations.test.mjs` (58 lines) and its `limits.test.mjs` changes.
- Solutions:
  - [best] the claim carries a time, reads ignore expired claims, and a Schedule sweeper fails, requeues or deletes them (DR's fix touches `quota-sql.ts`, `quotas.ts`, `code-image-cleanup.ts`; Fable read the stat only)
  - [acceptable] a staleness check on read that marks it failed (strata `2481a63`)
  - [over-engineered] a heartbeat table with a watchdog process; a Workflow compensation step per publish
  - [masks-symptom] release in a `finally` (a killed isolate never runs it); a longer client timeout
  - [wrong] delete the record; count quota without reservations
- Traps: `finally`, which passes a test that throws and fails one that stops; fixes only the UI.
- Evidence: real, strata `2481a63`; Drop `983468e5`.
- Difficulty: 3 (J), 4 (DR) · Static-detectable: partly
- From: opus QW8 · fable D-02

### Q10 A late progress update overwrites "completed"
- Type: both · Class: bug · Primitive: KV, Queue, Workflow · Why: W5, W6
- Fixture: J, `updateJob(id, patch)` as `kv.get`, spread, `kv.set`. A fake workflow posts `completed`, then a late `processing`. About 25 lines.
- Report: "It finished, then the page went back to the spinner forever."
- Root cause: an unordered read-modify-write with no terminal state.
- Why it gets written: `kv.get`/`kv.set` reads like a row update, and Queue, Workflow and Sandbox callbacks arrive in any order.
- Verification: over 100 random orderings of complete then late progress, GET still returns `completed`.
- Solutions:
  - [best] monotonic status in the Database: `update … where status not in ('completed','failed')`
  - [acceptable] a guard in `updateJob` that keeps terminal states (strata `9c3536d`); a version compare-and-swap
  - [over-engineered] job state in a Durable Object (strata `72ca27c`; right at Cloudflare scale, heavy for one record)
  - [masks-symptom] repair `result && status !== 'completed'` on GET
  - [wrong] debounce the progress updates
- Traps: adds sleeps; reorders calls in the workflow.
- Evidence: real, strata `9c3536d`, `72ca27c`.
- Difficulty: 3 · Static-detectable: yes
- From: opus QW9

### Q11 A notification sent from a GET
- Type: both · Class: bug · Primitive: Email, Workflow · Why: W6, W5
- Fixture: J. `GET /api/analyses/:id` calls `await sendNotificationIfNeeded(job)`, which reads a `notified` flag, sends, then sets it.
- Report: "The result page shows an error whenever email is misconfigured. People also got the 'done' email several times."
- Root cause: a side effect on a read path. A mail failure becomes a 500, and concurrent GETs race the flag.
- Why it gets written: "notify when someone first sees it's done" puts the effect wherever completion is noticed.
- Verification: with a failing mail driver, GET returns 200; 5 concurrent GETs send 1 mail.
- Solutions:
  - [best] send from the workflow's completion step or a job, with a conditional claim on `notifiedAt`
  - [acceptable] keep it in GET, claim atomically, send after the response (`waitUntil`)
  - [over-engineered] an outbox table with a dispatcher
  - [masks-symptom] `try/catch` around the send · the real commit's fix; duplicates stay
  - [wrong] cache the GET
- Traps: copies the historical fix. This case checks whether an agent beats it (ranking it masks-symptom is Opus's judgment).
- Evidence: real, strata `78a28f4`.
- Difficulty: 3 · Static-detectable: yes
- From: opus QW10

### Q12 A dedupe key that hashes volatile fields
- Type: A · Class: perf · Primitive: Database, Schedule · Why: W6
- Fixture: J. A webhook route plus a 15-minute reconcile poller store `deliveries(id PK, payload)`; the poller's id is `sha256(JSON.stringify(payload))`, and the payload carries `updated_at`. About 30 lines.
- Report: "The database grows by gigabytes a day and /api/health times out."
- Root cause: the key covers fields that change, so each poll stores every item again.
- Why it gets written: "hash the payload" is the reflex for a dedupe key.
- Verification: poll twice with unchanged data, then change only `updated_at`: the row count stays the same both times.
- Solutions:
  - [best] a key over stable identity (number and head sha) or the upstream delivery id (babysitter `d374d9ddd`)
  - [acceptable] canonical JSON with `*_at` and url keys dropped and keys sorted (babysitter `1a773f605`)
  - [over-engineered] a content-addressed store with dedupe on read
  - [masks-symptom] TTL cleanup of old rows
  - [wrong] `INSERT OR REPLACE` · writes and work remain
- Traps: adds a cleanup job and calls it done.
- Evidence: real, babysitter `d374d9ddd` (27k rows an hour, 18 GB), `2208a8287`, `1a773f605`.
- Difficulty: 3 · Static-detectable: partly
- From: opus QW11

### Q13 The RSVP waits for the mail provider
- Type: both · Class: perf · Primitive: Queue, Email, Database · Why: W1, W6
- Fixture: M, `rsvp.post.ts:29-35`: replace the enqueue with an awaited `sendRsvpMail`. 3-6 lines.
- Report: "Booking takes several seconds. Sometimes it says it failed even though my seat was saved."
- Root cause: the booking response is tied to a slow, fallible send after the reservation already committed.
- Why it gets written: sequential `await` reads naturally and merges two success conditions with different retry policies.
- Verification: a mail stub held behind a barrier doesn't hold the RSVP response (p95 under 200 ms); release or fail the stub, run the job, and the reservation stands and the confirmation follows the retry policy.
- Solutions:
  - [best] enqueue through the ViteHub Queue with a stated enqueue-failure policy (M logs it)
  - [acceptable] a transactional outbox consumed by the queue · only if every committed RSVP must get mail (open question 10)
  - [over-engineered] an event bus with several delivery services
  - [wrong] an unawaited `sendMail()` promise; `waitUntil` presented as durable retries
- Traps: claims the enqueue is atomic with the insert.
- Evidence: synthetic reversal of M's route.
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-32

### Q14 Push watch started before the cursor
- Type: both · Class: bug · Primitive: KV cursor, Schedule · Why: W5
- Fixture: EL at `5f3d3542^` (real code): watch registered before the baseline cursor is captured. About 10 lines. Run against a provider stub, never real Gmail.
- Report: "Right after I turn on push sync, a few emails never get labelled. Later messages work."
- Root cause: messages that arrive between the watch and the cursor read fall before the stored cursor.
- Why it gets written: registering push first sounds safer; the real invariant is the cursor/subscription order.
- Verification: inject a message exactly between watch and cursor capture, then sync: it is processed; duplicate notifications don't multiply effects.
- Solutions:
  - [best] capture and persist the baseline before enabling the watch (the real fix)
  - [acceptable] a provider-side atomic handshake, if one exists (don't invent it)
  - [over-engineered] reclassify the whole inbox on every push
  - [masks-symptom] wait a few seconds before enabling push
- Traps: blames the provider; advances the cursor before work is durable.
- Evidence: real, email-labeller `5f3d3542b6`.
- Difficulty: 4 · Static-detectable: partly
- From: sol SOL-37

### Q15 The reminder tick outlasts its interval
- Type: A · Class: perf · Primitive: Schedule, Queue, Database · Why: W1, W7
- Fixture: M, `event-reminders.ts`: the window moves from SQL into a JS loop over every future RSVP with one query per row. Seed 200,000 RSVPs, 5,000 due. 12 lines.
- Report: "Reminder emails arrive hours late on busy days. Some people get them after the event."
- Root cause: each tick loads every future RSVP and runs a query and an enqueue per row in series, so a tick outlasts 15 minutes.
- Why it gets written: JS filters read more easily than three SQL conditions, and the seed has ten RSVPs.
- Verification: one `vitehub schedule run event-reminders`: at most 3 DB calls, reads at most the due rows plus a constant (query log), queues exactly 5,000 jobs; a second run queues 0.
- Solutions:
  - [best] the window and `isNull(reminderSentAt)` in SQL (M `event-reminders.ts:18-24`), enqueues in bounded parallel chunks
  - [acceptable] the SQL filter with serial enqueues; one job per event that mails its attendees
  - [over-engineered] a Workflow per event sleeping until the day before
  - [masks-symptom] a cron every minute, or `LIMIT 500` per tick
  - [wrong] `Promise.all` over 200,000 rows
- Traps: the `Promise.all`, which exhausts the database.
- Evidence: synthetic plant; the class is real: babysitter `94cf746a1` (walked 20k journal rows a minute), email-labeller `8882c29`.
- Difficulty: 3 · Static-detectable: yes
- From: fable P-11

### Q16 `idempotencyKey` refused on Cloudflare
- Type: both · Class: nook · Primitive: Queue · Why: W2, W4
- Fixture: M-cf, unchanged. 0 lines planted: M's `runQueue(…, { idempotencyKey })` is the bug on this host.
- Report: "Since we moved to Workers nobody gets the 'you're going' email or the reminders. No errors for users."
- Root cause: the Cloudflare provider refuses `idempotencyKey`, `region` and `retentionSeconds` and returns `QUEUE_UNSUPPORTED_OPTION` without sending; M only logs the error, in the RSVP route and in the reminder schedule.
- Claim (a): **verified**. Pin `packages/queue/src/errors.ts:10` lists the refused options; `providers/cloudflare.ts:61-66` builds the error and `:149-150` returns it before `binding.send`. M logs and moves on at `server/api/events/[slug]/rsvp.post.ts:33-34` and `server/schedules/event-reminders.ts:27-28`. M builds `preset: "node"` (`nuxt.config.ts:37`), so the bug is latent until a Cloudflare port. On Workers no confirmation or reminder is ever enqueued.
- Why it gets written: the option is portable on Node and Vercel, and errors as values make the failure silent unless someone reads `[error]`.
- Verification: on Miniflare, an RSVP gives one job and one mail; a duplicate RSVP still sends once (the handler's claim). The enqueue result has no error.
- Solutions:
  - [best] drop `idempotencyKey` on Cloudflare and rely on the handler's claim, which is already idempotent (`mail.ts:27-30`)
  - [acceptable] choose options by host · more code
  - [masks-symptom] send inline when the enqueue errors
  - [wrong] retry the enqueue with the same options; throw the error to the user (the booking stood)
- Traps: blames Resend or the consumer config; never reads the logged `[error]`.
- Evidence: real latent bug in our own reference. A native finding for B on a Cloudflare variant.
- Difficulty: 4 · Static-detectable: yes, with primitive knowledge
- From: grok N01 (also inside grok M04, see MG12)

### Q17 `schedule: true` fails the Node build
- Type: A · Class: dx · Primitive: Schedule · Why: W2
- Fixture: M, `nuxt.config.ts:59`: `schedule: { runtime: { driver: "process" } }` becomes `schedule: true`, as a config clean-up would. 1 line.
- Report: the build output, then "build broke after the config cleanup PR. just make it build."
- Root cause: a Node host has no cron, so ViteHub refuses Schedules nothing would run, `VITE_HUB_R0137` (pin `packages/vite-hub/src/index.ts:653`, per Fable).
- Why it gets written: `schedule: true` works in dev, where the dev server runs everything.
- Verification: the build passes, and the built server sends a due reminder to the mail stub within 90 s.
- Solutions:
  - [best] restore the process driver, as the error text says
  - [acceptable] an outside cron calling a guarded route that runs the tick
  - [over-engineered] a `setInterval` in a server plugin
  - [wrong] `schedule: false`, deleting the schedule, or another preset to silence the error · green build, no reminders
- Traps: removes the feature to get a green build; the report invites it.
- Evidence: synthetic; findings-v5 saw R0137 in a real run.
- Difficulty: 1 · Static-detectable: yes
- From: fable N-03

### Blob (BL)

### BL1 The served store publishes private files
- Type: both · Class: security · Primitive: Blob, Auth · Why: W12, W9
- Fixture: M+ at the pin. Variant a (Opus): ticket PDFs via `blob.put(\`tickets/${rsvpId}.pdf\`, pdf, { access: 'private' })` in the store `/images` serves. Variant b (Grok): a "send me the CSV" job writes `exports/<eventId>.csv` to that store. About 25 lines.
- Report: "A guest says changing the number in their ticket link opens other people's tickets." Variant b: "Someone posted our attendee list online."
- Root cause: the serve route serves the whole store, not a prefix, and at the pin per-put `access: 'private'` changes nothing on fs, R2, S3 and the other drivers. `serve.authorize: true` alone only checks that someone is signed in.
- Why it gets written: `access: 'private'` and `authorize: true` read like per-object protection; `serve: { route: "/images" }` reads like "serve images". Pin `BlobServeOptions` has no prefix option and puts per-object checks in a separate `server/blob.ts` export (pin `packages/blob/src/types.ts:574-578`, verified).
- Verification: user A's GET of B's ticket or a non-organizer's GET of an export returns 403/404; the owner gets 200; anonymous 401. On main the planted `put` throws `BLOB_R0045`.
- Solutions:
  - [best] keep private files in a second, unserved store (or outside the served prefix) and download through an app route that checks ownership, then `blob.serve(event.req, path, { download: true })`
  - [acceptable] `serve.authorize: true` plus an `authorize` export that allows only `covers/` or checks ownership
  - [acceptable] short-lived signed URLs (`blob.sign`) · provider-dependent
  - [masks-symptom] unguessable names (`addRandomSuffix`) · still public once leaked
  - [wrong] `authorize: true` with no ownership check; `noindex`
- Traps: `authorize: true` and done; looks for a missing route instead of knowing `serve` covers the store.
- Evidence: real, `617e7da84f` (#4289, after the pin; its message: per-put `access` "changed nothing on fs, R2, Netlify, S3, GCS, Azure, or MinIO stores", verified with `git log`); Drop `76e65180` (a revoked teammate kept reading).
- Difficulty: 3-4 · Static-detectable: yes
- From: opus BL1 · grok S10

### BL2 An uploaded SVG runs script
- Type: both · Class: security · Primitive: Blob · Why: W12
- Fixture: M, `cover.put.ts:22-24`: `ensureBlob(file, { maxSize, types: ["image"] })`, and the `detectContentType` check removed. Variant (Opus): add `image/svg+xml` to `COVER_TYPES` and serve covers from a hand-written route that replays `file.type`. 2-20 lines.
- Report: "Our security scanner says a cover photo on our site runs JavaScript."
- Root cause: `ensureBlob` checks the type the browser declared, and the short type `"image"` admits any `image/*`, `image/svg+xml` included. The serve route answers with the stored type on the app origin.
- Claim (d): **verified**. Pin `packages/blob/src/ensure.ts:33-37` matches `blob.type.split("/")[0]` against `types`, so `"image"` admits SVG. Pin `packages/blob/src/content-type.ts:7-15` has no SVG signature, so M's byte check (`cover.put.ts:23-24`) refuses it. `blob.serve`'s `Content-Security-Policy: sandbox` for SVG came in `c62c0d2082` (#3998), after the pin, so at the pin the built-in route serves the SVG as is (Grok: pin `storage.ts:418-419`). M keeps SVG out on purpose (`shared/utils/cover.ts:1-2`).
- Why it gets written: `types: ["image"]` reads as "pictures only"; nothing in the name says "declared". `blob.get()` returning a Blob invites a hand-made Response.
- Verification: upload an SVG with `<script>` and a `text/html` body named `.png`: both 400. JPEG, PNG and WebP pass. If served, the response carries `Content-Security-Policy: sandbox` or `attachment`.
- Solutions:
  - [best] an explicit raster list plus `detectContentType()` on the bytes (M `cover.put.ts:22-24`)
  - [acceptable] decode and re-encode with sharp · strong, costs CPU
  - [acceptable] serve with `Content-Disposition: attachment` and a sandbox CSP, or from a separate file origin (`publicBaseUrl`) · contains the damage
  - [masks-symptom] strip `<script>` from SVGs · sanitizer bypasses exist
  - [wrong] check the file extension
- Traps: writes an SVG sanitizer; adds the byte check but keeps `"image"`.
- Evidence: real, `c62c0d2082` (#3998); rubric O6 and X9.
- Difficulty: 2-3 · Static-detectable: yes
- From: opus BL2 · grok S09

### BL3 The recording won't seek
- Type: A · Class: bug · Primitive: Blob · Why: W1
- Fixture: M+: an event recording served from `recording.get.ts` as `new Response((await blob.get(p))[1].stream())`. About 15 lines.
- Report: "The recording stops halfway in Firefox and never plays on my iPhone."
- Root cause: no `Range` support (no 206, no 416); Safari needs ranges and Firefox needs them to resume.
- Why it gets written: `blob.get` is the obvious API, and Chrome tolerates the missing ranges.
- Verification: `Range: bytes=100-199` gives 206 with `Content-Range` and 100 bytes; an unsatisfiable range gives 416.
- Solutions:
  - [best] `return blob.serve(event.req, path, { cacheControl })`, which honours `Range` and `If-None-Match` (Drop `4661d2cd`)
  - [acceptable] a hand-written 206/416 parser (Drop `253dddd1`, the first fix)
  - [over-engineered] transcode to HLS
  - [masks-symptom] `preload="auto"`, or download the whole file first
  - [wrong] send `Accept-Ranges: bytes` without honouring ranges
- Traps: blames the codec.
- Evidence: real, Drop `253dddd1` then `4661d2cd`.
- Difficulty: 2 · Static-detectable: partly
- From: opus BL3

### BL4 The upload buffers the body before the size check
- Type: both · Class: security · Primitive: Blob, h3 body · Why: W7
- Fixture: M as it stands (native), or a variant that checks `Content-Length` then reads `arrayBuffer()`.
- Report: "Someone uploaded a 2 GB 'photo' and the server ran out of memory."
- Root cause: the size check runs after the whole body is in memory; a chunked body has no `Content-Length`.
- Claim (g): **verified**. M `server/api/events/[slug]/cover.put.ts:18` calls `event.req.formData()`, and `ensureBlob`'s size check runs at `:22`. `blob.handleUpload` checking before buffering came in `58e55cf29b` (#4215), after the pin. h3 2.0.8 has `assertBodySize(event, limit)` and a `bodyLimit(limit)` middleware that counts as the body is read (`h3/dist/index.d.mts:683,752`, verified).
- Why it gets written: `formData()` then validate is the form every example uses.
- Verification: post a 300 MB chunked multipart body with no length: 413 after reading at most the limit plus 1 MB (counted by the client), server memory grows under 50 MB. A 3 MB photo still uploads.
- Solutions:
  - [best at the pin] `assertBodySize(event, limit)` or the `bodyLimit` middleware before `formData()`
  - [best on main] `blob.handleUpload(event, { multiple: false, ensure: { maxSize, types } })`
  - [acceptable] a `Content-Length` check plus a documented proxy limit
  - [over-engineered] presigned direct uploads; a hand-written streaming parser
  - [masks-symptom] lower the limit; a rate limit alone
  - [wrong] check `Content-Length` again after reading
- Traps: checks `Content-Length`, which a chunked request omits.
- Evidence: real, Drop `3253db64`; ViteHub `58e55cf29b`. A native weakness of M: fix the base before it becomes the oracle, then plant it back for this case (open question 2).
- Difficulty: 3 · Static-detectable: yes
- From: opus BL4 · fable S-02

### BL5 The new cover never shows
- Type: both · Class: bug · Primitive: Blob · Why: W10
- Fixture: M, `cover.put.ts:27`: drop `addRandomSuffix: true`, so `covers/<id>/cover` is reused, and keep the year-long `immutable` header on `/images` (`nuxt.config.ts`, blob serve). 1 line.
- Report: "I changed my event's cover photo and everyone still sees the old one."
- Root cause: an immutable year-long cache on a reused pathname.
- Why it gets written: the cache header and the upload path live in different files; "immutable" is right only for unique paths.
- Verification: upload A, GET it, upload B: the page HTML points at a URL whose bytes are B's, and no URL ever served changes content.
- Solutions:
  - [best] a unique path per upload and delete the old object (M)
  - [acceptable] a version in the URL (`?v=<updatedAt>`); `private, no-cache` with ETag revalidation (Drop `82f67277`)
  - [over-engineered] purge the CDN on upload
  - [masks-symptom] `no-store` · every view downloads again
  - [wrong] tell users to hard-refresh
- Traps: `no-store`; removes the header.
- Evidence: M's design; Drop `82f67277`; main's edge cache `99a876c7d2` (#4282) warns that nothing purges an edge copy.
- Difficulty: 2 · Static-detectable: partly
- From: opus BL5 (decoy DC12 is the same code with the suffix kept)

### BL6 Cards download full-size covers
- Type: both · Class: perf · Primitive: Blob variants · Why: W7
- Fixture: M, `EventCard.vue` and `EventCover.vue`: `coverUrl(path, 640)` becomes `/images/${path}`; `width`, `height`, `loading` go. Seed 3-4 MB covers. 6 lines.
- Report: "home page takes forever on mobile data. devtools says 60 MB"
- Root cause: every card downloads the original upload, all 24 at once.
- Why it gets written: the stored path works as a URL, so the variant parameter looks optional.
- Verification: Playwright at 390×844 on `/`: first-screen image bytes ≤ 1.5 MB [G], no card image wider than 1,280 px, below-fold images not requested before scroll, layout shift 0.
- Solutions:
  - [best] the serve route's `?w=` variants with `width`, `height`, `loading="lazy"` (M `shared/utils/cover.ts:7-9`, `EventCard.vue:23-27`)
  - [acceptable] `?w=640` alone
  - [over-engineered] resize at upload into three files with a Queue job; a second pipeline through `@nuxt/image`
  - [masks-symptom] `loading="lazy"` alone
  - [wrong] CSS width
- Traps: doesn't know the serve route resizes and builds a resizer.
- Evidence: synthetic plant; ViteHub variant code (pin `packages/blob/src/media/variant.ts:44`, per Fable); Drop `5c86a12a`.
- Difficulty: 2 · Static-detectable: yes
- From: fable P-07

### BL7 A blanket `no-store` re-downloads every cover
- Type: A · Class: perf · Primitive: Blob serve headers, route rules · Why: W10
- Fixture: M, `nuxt.config.ts`: a production `"/**"` header rule gains `Cache-Control: no-store` "to stop a stale dashboard". 1 line. Which header wins between a route rule and Blob's `serve.headers` is unchecked [G]; if Blob wins, plant it in `blob.serve.headers`.
- Report: "bandwidth doubled since last week's release and nothing else changed"
- Root cause: one blanket rule made the immutable cover URLs uncacheable.
- Why it gets written: a stale page gets fixed with the widest rule that works.
- Verification: `/images/<cover>?w=640` is cacheable (max-age ≥ a day, or a 304 on ETag); a second Playwright visit transfers 0 image body bytes; `/api/dashboard` and the CSV stay `no-store`/`private`; errors aren't cacheable.
- Solutions:
  - [best] drop the blanket rule and put `no-store` on the personal routes that needed it
  - [acceptable] a narrower `/images/**` rule; ETag revalidation as Drop does
  - [masks-symptom] a CDN in front
  - [wrong] `public, max-age=31536000` on `"/**"` · caches personal pages and errors
- Traps: fixes images and makes the dashboard cacheable.
- Evidence: real, Drop `82f67277` (and its "keep ETagged error responses uncacheable" follow-up).
- Difficulty: 2 · Static-detectable: yes
- From: fable P-08

### BL8 The upload trusts the client's path
- Type: both · Class: security · Primitive: Blob, Auth · Why: W9
- Fixture: M, `cover.put.ts`: the client sends the event id or object path in the form; the route checks only `requireUser` and writes there. Size and type checks stay correct. 8-15 lines.
- Report: "A user can replace another organizer's event cover by changing the upload request."
- Root cause: storage helpers don't establish ownership; a client-supplied owner or path is not an authorization decision.
- Why it gets written: moving to a helper can drop checks that belonged to the app.
- Verification: anonymous and wrong-organizer uploads write 0 objects; `../` and cross-owner names fail; valid images still upload and show.
- Solutions:
  - [best] authorize the event (`findOwnedEvent`), derive the key on the server, keep the Blob checks (M)
  - [acceptable] a small bounded handler with `blob.put` and the same checks
  - [over-engineered] a full media pipeline
  - [wrong] trust `file.type` or the client owner id
- Traps: checks only that a session exists; removes validation while fixing; calls `ensureBlob` full content safety.
- Evidence: synthetic.
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-28

### BL9 An R2 binding can't presign
- Type: both · Class: nook · Primitive: Blob, Env · Why: W2
- Fixture: M-cf: a direct-upload route that calls `blob.sign` with only an R2 binding configured. 5-10 lines plus config.
- Report: "Normal photo uploads work in Workers, but the new direct upload button always fails to get a URL."
- Root cause: a binding reads and writes but can't produce S3-compatible signatures; presigning needs credentials.
- Why it gets written: one Blob API hides driver differences, but signing has its own capability and credential contract (main `docs/content/docs/blob/server-api.md:237`, per Sol).
- Verification: with a binding-only mock, the fallback succeeds or returns the precise unsupported error; with a signing test provider, the browser PUT sends every signed header and respects expiry; no credential in payload or bundle.
- Solutions:
  - [best] binding-backed `handleUpload` or multipart when direct signing isn't required
  - [acceptable] signing credentials through server env, returned headers preserved
  - [over-engineered] an always-on upload proxy
  - [wrong] keys in `runtimeConfig.public`; a URL built from the bucket name
- Traps: demands keys when the binding path suffices.
- Evidence: synthetic; docs lines per Sol.
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-29

### Auth and session (AU)

### AU1 Signed-in pages read the session once per component ("Vue portal")
- Type: A · Class: perf · Primitive: Auth, Nuxt data fetching · Why: W7, W3
- Fixture: M. Replace `useAuth()`'s `useState` and the `callOnce` plugin (`app/plugins/session.ts`) with `useMe()` = `useFetch('/api/me')`, called by the header and by every `EventCard` for the "You're going" badge. Variant (Grok): a universal plugin `await authClient.getSession()` with no payload, plus `useSession()` per card. About 30 lines.
- Report: "The home page is fine logged out but takes seconds when I'm logged in. The network tab shows get-session three times."
- Root cause: each call site starts its own session read during SSR, every read hits the database, and the browser reads again on hydration because nothing carried the result in the payload.
- Claim (f): **#4054 is the best match**. `gh pr view` on all four, verified:
  - #4054 (`47fc7f766d`, merged 2026-11-13, after the pin) "one shared session store for Vue and Nuxt, with Capsa's session behavior": "Every component keeps its own copy of the session … Hydration sends a `get-session` request right after the server already read the session." It is the Vue-side session fix and names another Vue app's behaviour as its model. That Capsa is the "portal" is a guess.
  - #4044 (`55fc3ffaa3`, 2026-11-12) has the numbers: signed-in `/` from 1,186 to 7,319 req/s median, CPU from 1,175 to 210 µs per request. It stops the session read and the 30 KB client prefetch on pages that don't use Auth.
  - #2692 (`2028c7ef9b`, 2026-10-22, before the pin) is bundle only: Better Auth's client loads on first use (AU2).
  - #4001 (`2ebdec974c`, 2026-11-12) is server guards rebuilding Better Auth and re-reading the session (AU3).
- Why it gets written: one key means one request in the browser, so a session composable called from leaf components looks free; SSR doesn't share it.
- Verification: count `get-session`/`/api/me` handler hits and session DB reads per SSR render: 1. A signed-in hard load makes 0 browser get-session requests (rubric D2). Drop measured 94 calls per page before its fix (`test/auth/ssr-fetch-runtime.mjs`).
- Solutions:
  - [best] one session state loaded once per request: `useState` plus `callOnce` in a plugin (M), and `going` per event from the list API
  - [acceptable] a `createUseFetch` wrapper with `dedupe: 'defer'` and `getCachedData` reading the payload (Drop `b772236e`)
  - [acceptable] on main, ViteHub's shared session store (#4054)
  - [over-engineered] a server LRU of sessions keyed by cookie · revocation lags
  - [masks-symptom] `server: false` or `lazy: true` · the calls move to the browser
  - [wrong] a module-level `ref` cache · leaks across users (SSR1)
- Traps: the module cache; `lazy`; `<ClientOnly>` around the header (flash, rubric H6).
- Evidence: real, Drop `b772236e`; ViteHub PRs above; run `20261109-1632-meetups-v2-codex-a2` D2 (two extra get-session calls from a universal plugin).
- Difficulty: 3 · Static-detectable: partly
- From: opus AU1 · sol SOL-12 · grok P07 (the duplicate get-session half)

### AU2 Better Auth's client in every page's entry chunk
- Type: A · Class: perf · Primitive: Auth (Vue client), code splitting · Why: W7
- Fixture: V (a public document viewer, Drop shape), or M with `createAuthClient` imported from `better-auth/vue` in a universal plugin. 1 import.
- Report: "Even a public document downloads all the sign-in code before I touch Sign in."
- Root cause: the shared shell imports the auth client statically, so Better Auth lands in the entry chunk of every route.
- Why it gets written: Better Auth's quickstart creates the client at import; a singleton looks cheap at the call site.
- Verification: build and read the client manifest: no Better Auth module in the entry chunk or the static imports of the public route; sign-in, sign-out and early unmount still work.
- Solutions:
  - [best] `createAuthClient` from `vite-hub/auth/vue`, which loads Better Auth on first use (#2692, before the pin; M `app/utils/auth-client.ts:2`)
  - [acceptable] a dynamic import of the adapter at the feature boundary
  - [over-engineered] rewrite authentication to shrink the bundle
  - [masks-symptom] preload the auth chunk; hide the spinner
- Traps: invents `loadAuthClient` on a build without it; measures only the entry chunk.
- Disagreement resolved: Sol read an October checkout (HEAD `451425205f`) where `packages/auth/src/vue.ts:1` imports Better Auth eagerly and doubted the lazy client exists. At the pin it does: #2692 merged 2026-10-22, before the pin, and M already uses it.
- Evidence: real, ViteHub #2692; Drop `f949cdb7` ("pages load Better Auth's client only when someone signs in or out").
- Difficulty: 3 · Static-detectable: partly
- From: sol SOL-11 · grok P07 (the bundle half)

### AU3 A global middleware reads the session on every request
- Type: A · Class: perf · Primitive: Auth, Database · Why: W7
- Fixture: M: `server/middleware/auth.ts` calls `auth.api.getSession({ headers })` for every request, `/images/**` and public `/api/events` included, and handlers still call `requireUser`. About 10 lines.
- Report: "Since we added the login check, server CPU doubled and pages with lots of photos load slowly."
- Root cause: a session read on requests that don't need it, plus a second read in each guarded handler.
- Why it gets written: "load the user in middleware" is the Express habit, and Nitro middleware runs for every route, the Blob serve route too.
- Verification: session reads per request through the counting libSQL proxy or the request's `database.calls` (pin `packages/database/src/runtime/request-stats.ts`; needs a request logger): 0 on `GET /api/events` and images, 1 on `GET /api/dashboard`; a page with 12 covers runs ≤ 2.
- Solutions:
  - [best] remove the global read; `requireUser` per route (M), memoized on `event.context`
  - [acceptable] keep the middleware on guarded prefixes only, memoized
  - [acceptable] Better Auth `session.cookieCache` · fewer reads, revocation lags (see AU10)
  - [over-engineered] a cross-request LRU or KV session cache
  - [masks-symptom] cache public pages
  - [wrong] a cached handler on guarded routes (KV5)
- Traps: cookie cache alone, which leaves the middleware running on images.
- Evidence: real, ViteHub `2ebdec974c` (#4001: each guard re-read the session, about 300 KiB per guard); Drop `d7ca11fb`.
- Difficulty: 3 · Static-detectable: yes
- From: opus AU2 · grok P06

### AU4 A path-compare guard misses `/export/`
- Type: both · Class: security · Primitive: Auth, Nitro routing · Why: W9
- Fixture: M+: `server/api/admin/export.get.ts` (all attendee emails) with no check of its own, guarded in `server/middleware/admin.ts` by `if (event.url.pathname === '/api/admin/export') await requireAdmin(event)`. About 15 lines.
- Report: "Someone downloaded our full attendee list without an account."
- Root cause: the middleware compares the raw path, but the router normalizes it: `/api/admin/export/` and `/api/%61dmin/export` reach the handler unchecked.
- Why it gets written: one guard in one middleware looks central and complete.
- Verification: signed out, `GET /api/admin/export/`, `GET /api/%61dmin/export` and `HEAD /api/admin/export` all return 401.
- Solutions:
  - [best] check inside the handler (`requireUser` and a role), as M does in every route
  - [acceptable] ViteHub `access.routes: ['/api/admin/**']` · matches as the router reads paths only since `8c2b89d5e2` (#4288, after the pin)
  - [over-engineered] your own path normalizer
  - [masks-symptom] more string variants, `startsWith`
  - [wrong] block `%` in URLs
- Traps: patches the one string compare.
- Evidence: real, `8c2b89d5e2` (#4288).
- Difficulty: 3 · Static-detectable: yes
- From: opus AU4

### AU5 Reset links built from the Host header
- Type: both · Class: security · Primitive: Auth, Email · Why: W9
- Fixture: M, `server/auth.ts`: `baseURL: requestOrigin` instead of `siteUrl || requestOrigin`; variant adds `trustedProxyHeaders: true`. 1-2 lines.
- Report (a researcher): "Your password-reset email links to whatever Host I send."
- Root cause: the link's origin comes from the request's Host (or `X-Forwarded-Host`), which the attacker chooses, so the reset token goes to their domain.
- Why it gets written: in a handler "the current origin" feels free and makes dev work on any port; jobs and schedules have no request, so authors cache or derive it.
- Verification: request a reset for the victim with `Host: evil.test` (and a forged `X-Forwarded-Host`): the stub mail links to the configured origin.
- Solutions:
  - [best] a configured public origin: `NUXT_PUBLIC_SITE_URL` (M `server/auth.ts:12-14`); on main `vitehub({ publicUrl })` (`1a644ec64c`, #4293, after the pin)
  - [acceptable] `trustedOrigins` plus refusing unknown Hosts
  - [over-engineered] per-tenant origin tables
  - [masks-symptom] ignore only `X-Forwarded-Host`
  - [wrong] `getRequestURL(event, { xForwardedHost: true })`; strip the header in Nuxt middleware (Better Auth reads it first)
- Traps: trusts forwarded headers; misses it in B because it needs Better Auth's URL code (`better-auth/dist/utils/url.mjs:68-76`, per Grok).
- Evidence: real, `1a644ec64c` (#4293); joxi `9f1bd85` finding 14 (scheduled mail linked to the last request's Host).
- Difficulty: 2-4 · Static-detectable: partly
- From: opus AU5 · grok S17

### AU6 The sign-up hook trusts the email
- Type: both · Class: security · Primitive: Auth (Better Auth hooks) · Why: W9
- Fixture: ST at `0bb47fe`: `databaseHooks.user.create.before` lets any `@guests.invalid` email through, then refuses sign-up once a user exists. About 15 lines (real).
- Report: "Sign-up is supposed to be closed, but there's a new account I didn't make."
- Root cause: the hook trusts a field the attacker sets to tell server-made users from public sign-ups.
- Why it gets written: one hook runs for public sign-up and server `createUser`, and the email looks like a safe marker.
- Verification: with one user seeded, `POST /api/auth/sign-up/email` with `x@guests.invalid` returns 403 and the count stays 1; a role-carrying server `createUser` still works.
- Solutions:
  - [best] trust only fields sign-up can't set, such as `role` (`input: false` under `admin()`) (`8b32030`)
  - [acceptable] an invitations table checked in the hook
  - [over-engineered] separate auth instances for guests
  - [masks-symptom] hide the sign-up form
  - [wrong] validate the email format
- Traps: hides the form.
- Evidence: real, nuxt-evals `0bb47fe` → `8b32030`.
- Difficulty: 3 · Static-detectable: yes
- From: opus AU6

### AU7 Signed in is treated as owner
- Type: both · Class: security · Primitive: Auth, Database · Why: W9
- Fixture: M. In `attendees.get.ts:7`, `attendees.csv.get.ts:13`, `index.patch.ts:11` and `cover.delete.ts`, replace `findOwnedEvent(slug, user.id)` with `findEventBySlug(slug)`. One case per route set: read (attendees, CSV) or write (patch, cover). 2 lines.
- Report: "Someone changed the date of my meetup to last year. I'm the only organizer." Read variant: "A guy who isn't the organizer sent me my own attendee list."
- Root cause: the route checks that someone is signed in, never that they organize this event.
- Why it gets written: `requireUser` at the top looks like "protected"; the edit page loads through the owner check, so the UI looks safe; the two helpers have similar names.
- Verification: user B's GET, CSV, PATCH and cover DELETE on A's event return 404 (or 403), with the row and blob unchanged; the owner still gets 200.
- Solutions:
  - [best] the ownership check in the query, 404 for strangers (M `server/utils/events.ts:13-17`)
  - [acceptable] an inline `organizerId !== user.id` check; owner condition in the UPDATE's WHERE with 0 rows → 404; 403 instead of 404
  - [over-engineered] a role or permission framework for one rule
  - [masks-symptom] hide the Edit button
  - [wrong] client-side check, or route middleware on `/dashboard/**` (server routes don't run it)
- Traps: fixes PATCH and misses the CSV or the cover route.
- Evidence: real, rubric A4 failed in 4/15 graded runs and A3 in 2/15; Drop `0b2c2d7d`; joxi `1fd3769`.
- Difficulty: 1-2 · Static-detectable: yes
- From: opus NX3 · grok S01 · grok S02

### AU8 The body picks the event
- Type: B · Class: security · Primitive: Auth, Database · Why: W9
- Fixture: M+ with co-organizers: `co-organizers.post.ts` inserts `{ eventId: body.eventId, userId: body.userId }` after `requireUser` only. 3 lines.
- Root cause: the body chooses the resource; authorization is "signed in".
- Why it gets written: the id comes from a hidden form field the UI fills, and the route reads like a join-table insert.
- Verification: user B adds themselves to A's event: 403/404.
- Solutions:
  - [best] take the event from the route param through `findOwnedEvent`
  - [acceptable] the ownership check inside `INSERT … SELECT`
  - [wrong] check that `userId` equals the caller
- Traps: checks the invitee, not the inviter.
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: yes
- From: grok S19

### AU9 The CSRF and origin checks turned off
- Type: both · Class: security · Primitive: Auth · Why: W12, W9
- Fixture: M, `server/auth.ts`: `advanced: { disableCSRFCheck: true }` and `baseURL` from the request origin only. 2 lines.
- Report: "Behind our nginx, sign-in said 'Invalid origin'. We fixed it, but our pentester flagged auth."
- Root cause: the mismatch came from TLS termination; disabling the check lets any origin post to the auth endpoints.
- Why it gets written: the error names the check, and turning it off makes the symptom go away. The right fix, a public `baseURL`, lives in another file. Better Auth turns the origin check off under test (`create-context.mjs:210-211`, per Grok), so a test suite passes with the hole open.
- Verification: a sign-in POST with `Origin: https://evil.example` is refused; sign-in behind `X-Forwarded-Proto: https` with the configured URL succeeds with a `Secure` cookie (rubric A2).
- Solutions:
  - [best] `baseURL` from `NUXT_PUBLIC_SITE_URL` (M `server/auth.ts:12-14`)
  - [acceptable] `trustedOrigins` with the public origin
  - [wrong] `disableOriginCheck`; `trustedProxyHeaders: true` without a proxy that overwrites the headers
- Traps: keeps `disableCSRFCheck` and adds `trustedOrigins` on top.
- Evidence: real, Drop `77ae1a8b` (sign-in loop behind the auth proxy).
- Difficulty: 3 · Static-detectable: yes
- From: grok S12

### AU10 A removed privilege lives on in the cookie cache
- Type: both · Class: security · Primitive: Auth (Better Auth cookie cache) · Why: W10
- Fixture: M+: an organizer-only export authorizes from a custom session field with `session.cookieCache` on; an admin removes the privilege. 5-12 lines.
- Report: "I removed someone's organizer access, but they can still download attendees for a while."
- Root cause: a signed cached session is authentic but stale; the export trusts its policy field.
- Why it gets written: cookie cache is a performance option, and a valid signature looks like a current decision.
- Verification: get a cached session, revoke, immediately request the export with the old cookies: 403; ordinary reads keep the cache policy.
- Solutions:
  - [best] read current authorization for sensitive operations, bypassing the cookie cache (`disableCookieCache`, per Sol in ViteHub's auth input)
  - [acceptable] disable cookie caching for the app
  - [over-engineered] a custom invalidation bus
  - [masks-symptom] a shorter cache TTL
- Traps: uses the issue's proposed `refreshSessionCookieCache` as if it existed; trusts client session state.
- Evidence: real report better-auth/better-auth#11501 (1.7.6); the fixture is an adaptation; unverified on M's 1.7.15.
- Difficulty: 4 · Static-detectable: partly
- From: sol SOL-13

### AU11 The header says "Sign in" in the server HTML
- Type: A · Class: nook · Primitive: Auth (Vue) · Why: W3
- Fixture: M: the header uses `useUserSession()` from `vite-hub/auth/vue` directly; `app/plugins/session.ts` and `useAuth` go. 10 lines.
- Report: "When I'm logged in, the page flashes 'Sign in' for a moment before showing my name."
- Root cause: at the pin, the client store stays pending during SSR, so the user never reaches the payload.
- Why it gets written: `useUserSession` is the composable the docs name, and it looks universal.
- Verification: curl with a session cookie: the SSR HTML holds the user's name; 0 browser get-session calls on load (rubric H1/H6).
- Solutions:
  - [best] load the session once on the server into `useState` (`callOnce`, `useRequestFetch`) (M `plugins/session.ts`, `useAuth.ts`)
  - [acceptable] middleware that fills `useState` from a server-only helper
  - [acceptable] on main, the shared store from #4044/#4054, which reads on the server
  - [masks-symptom] `<ClientOnly>` with a skeleton
- Traps: the mask.
- Evidence: real, rubric S1 failed in 4/15 runs (`20261109-2001-meetups-v2-codex-a1`: "returns a pending, empty state on the server"); ViteHub #2692 says hooks "stay pending" during SSR.
- Difficulty: 3 · Static-detectable: yes
- From: grok N03

### AU12 Forgot-password timing tells who has an account
- Type: both · Class: security · Primitive: Auth, Email · Why: W1
- Fixture: M, `server/auth.ts`/`mail.ts`: the reset response waits for the send. How to plant it depends on how Better Auth 1.7 schedules `sendResetPassword` [G]. The mail stub takes 1,500 ms.
- Report: "A pentest says our forgot-password form tells you which emails have accounts."
- Root cause: the response time differs by the send's duration between known and unknown addresses.
- Why it gets written: `await` before a send is the default, and a fast dev mailer hides it.
- Verification: 20 requests each for a known and an unknown address: medians differ by under 50 ms; same status and body.
- Solutions:
  - [best] the response doesn't wait for the send (M's comment at `server/utils/mail.ts:71-75`)
  - [acceptable] hand the send to the host's `waitUntil`
  - [over-engineered] queue it · the token then sits in the queue store (M's comment)
  - [masks-symptom] sleep 1.5 s for unknown addresses · differs under load
  - [wrong] 404 for unknown addresses
- Traps: the sleep.
- Evidence: synthetic; M documents the rule.
- Difficulty: 3 · Static-detectable: partly
- From: fable S-01

### Database (DB)

### DB1 Seats left goes negative
- Type: both · Class: bug · Primitive: Database · Why: W5, W1
- Fixture: M, `rsvp.post.ts:18-27`: replace the one conditional `insert … select … where count < capacity` with `const left = await seatsLeft(id); if (left <= 0) throw 409; await db.insert(rsvps)…`, and drop the `max(…, 0)` in `seatsLeft`. The unique index stays. 8-12 lines.
- Report: "Seats left goes negative when two people RSVP at once. 14 people came to a 12-seat event." (Maxi's example.)
- Root cause: check-then-insert across an `await`; two requests both read a free seat, then both insert.
- Why it gets written: it is the plain transcription of the rule. SQLite feels single-threaded, but every `await` yields, and D1 has no interactive transaction to hide it in.
- Verification: 30 distinct users RSVP at once to a 12-seat event against **two server processes** on one database file: exactly 12 rows, 18 × 409, `seatsLeft ≥ 0`, over 5 repeats (rubric P12). Also a barrier after the read. Distinct users matter: one user's repeats hit the unique index and mask the race.
- Solutions:
  - [best] one `INSERT … SELECT … WHERE (select count) < capacity ON CONFLICT DO NOTHING RETURNING` (M)
  - [acceptable] a counter column, `UPDATE … SET taken = taken + 1 WHERE taken < capacity RETURNING`, then the insert in `db.batch()` · works on D1, needs a compensating decrement
  - [acceptable] a `BEFORE INSERT` trigger with `RAISE(ABORT)` (Drop `7093d7c0`)
  - [acceptable, not portable] `BEGIN IMMEDIATE` / `db.transaction()` on SQLite or libSQL · fails on D1
  - [over-engineered] a Queue with concurrency 1 per event, a Durable Object, a KV lock
  - [masks-symptom] clamp the display; disable the button
  - [wrong] an in-memory mutex per event · passes a one-process test
- Traps: clamps; adds a mutex; `db.transaction` on a D1-bound app.
- Evidence: real, rubric B6 failed in 7/15 graded runs (`20261109-1448-meetups-v2-codex-a3`: "reads capacity first, then inserts"); Drop `7093d7c0`; joxi `9f1bd85`. M is the best fix.
- Difficulty: 3 · Static-detectable: yes
- From: opus DB1 · sol SOL-35 · grok C01

### DB2 One seat-count query per event
- Type: both · Class: perf · Primitive: Database · Why: W1, W7
- Fixture: M, `dashboard.get.ts` (or `events/index.get.ts`): select the rows, then `for (const e of rows) e.seatsLeft = await seatsLeft(e.id)` (variant: `Promise.all`). Seed an organizer with 80 events. 6-8 lines.
- Report: "The dashboard takes 4 seconds for organizers with a lot of events."
- Root cause: N+1 queries, each a round trip on libSQL, Turso or D1.
- Why it gets written: `seatsLeft()` exists and a loop is the obvious reuse; local SQLite makes each call nearly free.
- Verification: query count per request ≤ 2 (counting proxy, or `database.calls` per Opus's main-side signature `calls: 9, maxConcurrent: 1`); with 20 ms injected per query, p50 < 100 ms; exact totals for 0, 1 and many attendees.
- Solutions:
  - [best] one grouped query with a count join (M `dashboard.get.ts`, `index.get.ts:27-49`)
  - [acceptable] a correlated subquery; one `GROUP BY event_id WHERE event_id IN (…)` merged in JS (watch D1's 100 parameters)
  - [over-engineered] a denormalized counter kept by triggers
  - [masks-symptom] `Promise.all` (fewer waits, same calls); cache the dashboard
  - [wrong] paginate to 10 events
- Traps: `Promise.all` and done; an inner join drops zero-attendee events; COUNT on an outer join counts the null row; batching loses the owner filter.
- Evidence: real, ViteHub `98950de406` (#2694); Drop `a4996961`; rubric B10 failed 3/15.
- Difficulty: 2 · Static-detectable: yes
- From: opus DB2 · sol SOL-36 · grok P01

### DB3 Independent reads wait in line
- Type: A · Class: perf · Primitive: Database, Nuxt data fetching · Why: W1
- Fixture: M. Server form: `[slug]/index.get.ts` runs the 5 reads one after another. Page form (Fable): the page's one `/api/events/:slug` call split into four awaited `useFetch` calls with their own routes. Large-app form: DR at `a4996961^` (`82f67277`), no plant. Inject 40-80 ms per DB call.
- Report: "The event page is slow only in production; the database is in another region. Locally it's instant."
- Root cause: independent round trips run in series, on the server or across SSR fetches.
- Why it gets written: one `await` per line reads well, and local SQLite hides the chain.
- Verification: M: with 80 ms per DB call, TTFB ≤ 250 ms (planted about 500 [G]); the SSR HTML still has title and OG tags; no second browser request for the data. DR: the fix's `test/cost/round-trips.test.mjs` (waves through a Drizzle `sqlite-proxy`: link 1, detail 2, comments 2, image 1, page 3, no table scan); accept page ≤ 4 for the gate and keep 3 as the best mark.
- Solutions:
  - [best] `Promise.all` over independent reads in one endpoint (M `[slug]/index.get.ts:12-16`); in DR, ancestors in one query plus `Promise.all`
  - [acceptable] one joined query; keep four endpoints but start them together
  - [over-engineered] read replicas, an edge cache, a KV cache per piece
  - [masks-symptom] `lazy: true` (TTFB passes because the data left the HTML; the OG check fails); Smart Placement alone
  - [wrong] `server: false`; caching a response that carries per-user fields
- Traps: `lazy`. Contrast with DB2: here `Promise.all` is best, there it masks. Rewarding the same move differently shows whether the agent read the cause.
- Evidence: real, Drop `a4996961` (11 → 3 round trips), `d7ca11fb`, `57be0e1f`.
- Difficulty: 2 (M), 4 (DR) · Static-detectable: yes
- From: opus DB3 · grok P05 · fable P-09 · fable D-01

### DB4 D1's 100 bound parameters
- Type: both · Class: nook · Primitive: Database (D1) · Why: W2
- Fixture: M-cf. Variant a: `POST /api/events/[slug]/invites` imports 60 emails with `db.insert(invites).values(rows)` (4 columns). Variant b: the dashboard loads 150 event ids and counts with `inArray(rsvps.eventId, ids)`. Variant c: a hand-tuned `CHUNK = 25` plus a task "add a `note` column". 4-25 lines.
- Report: "Importing my attendee list fails on the live site. It works on my laptop." / "Our biggest organizer gets an error page on the dashboard."
- Root cause: D1 binds at most 100 parameters per statement; 60 × 4 = 240.
- Why it gets written: libSQL allows far more, Drizzle doesn't warn, and a chunk constant lives far from the schema.
- Verification: vite dev with `preset: 'cloudflare'` checks D1 limits (`59b44644ad`, #3443, before the pin) and throws `DATABASE_D1_TOO_MANY_PARAMETERS` before the fix; 250 rows or 150 events succeed after.
- Solutions:
  - [best] variant a: `chunkParameters(rows, { reserved })` (`6e0d4f1187`, #3270, before the pin) inside `db.batch()` when it must be atomic; variant b: one grouped LEFT JOIN, no id list (M `dashboard.get.ts`)
  - [acceptable] a chunk size from `getTableColumns(table)`; one JSON parameter with `json_each`
  - [masks-symptom] one row per statement · N round trips
  - [wrong] a hard-coded chunk (joxi `c8cb008`: 7 × 14 = 98, then 15 columns made 105); chunks of 1,000
- Traps: can't reproduce without the Cloudflare host.
- Evidence: real, `6e0d4f1187`, `59b44644ad`; joxi `c8cb008`; Drop `1892ddcc`; drizzle-orm#2479.
- Difficulty: 3 · Static-detectable: partly (needs the host)
- From: opus DB4 · grok P11

### DB5 A generated migration cascades on D1
- Type: both · Class: bug · Primitive: Database (D1 migrations), Auth tables · Why: W11
- Fixture: ST before `6b37d2d`: adding Better Auth organization tables makes `drizzle-kit generate` rebuild `user`, `session`, `account` (`__new_x`, copy, `DROP`, rename). The plant is that generated file (regenerate it; the "before" was never committed). About 60 SQL lines.
- Report: "We're adding teams. Here's the migration; make it safe to deploy." Variant: "After the auth upgrade, accounts still exist but sessions and passkeys disappeared."
- Root cause: on D1, `DROP TABLE user` cascades through `ON DELETE CASCADE`, deleting sessions and passkeys even when the parent rows are copied back; `PRAGMA foreign_keys=OFF` has no effect in D1's migration transaction.
- Why it gets written: generated SQL looks authoritative, and the rebuild is noise in a long diff.
- Verification: apply to a copy of a seeded database: session, account and passkey counts and row checksums unchanged; `foreign_key_check` clean.
- Solutions:
  - [best] a hand-trimmed additive migration: `CREATE TABLE` for the new tables, `ALTER TABLE session ADD active_organization_id` (`6b37d2d`)
  - [acceptable] a reviewed data-preserving rebuild, or back up and restore sessions
  - [over-engineered] a blue-green copy of the database; a new ORM
  - [masks-symptom] run it at night
  - [wrong] `PRAGMA foreign_keys=OFF` at the top
- Traps: applies it as generated; checks only parent row counts; trusts local SQLite.
- Evidence: real near-miss, nuxt-evals `6b37d2d68d` (its message says it was tested on a production D1 export); drizzle-orm#4938.
- Difficulty: 4 · Static-detectable: yes
- From: opus DB5 · sol SOL-25

### DB6 Lowering capacity below the people going
- Type: both · Class: bug · Primitive: Database · Why: W5
- Fixture: M, `index.patch.ts:15-19`: a separate `count()`, then an unconditional update. 4 lines.
- Report: "I lowered my event to 10 seats and it still has 13 people. Now it says 0 left forever."
- Root cause: count-then-update races with RSVPs, and with no check the organizer goes below the count.
- Why it gets written: it reads like form validation, not a concurrency rule.
- Verification: PATCH to 10 with 13 going gives 422; a parallel RSVP plus PATCH never ends with taken > capacity.
- Solutions:
  - [best] a conditional UPDATE with `capacity >= (select count …)` (M `index.patch.ts:16-19`)
  - [acceptable] an immediate transaction (not on D1)
  - [masks-symptom] clamp the display
- Traps: fixes the no-check case, keeps the race.
- Evidence: real, rubric B13 failed in 7/15 graded runs.
- Difficulty: 3 · Static-detectable: yes
- From: grok C02

### DB7 Comment numbers from read-then-insert
- Type: A · Class: bug · Primitive: Database · Why: W5
- Fixture: M+ with comments: `n = max(n) + 1` read, then inserted, with 5 retries on a unique violation. 20 lines.
- Report: "When lots of people comment at once some get 'Could not allocate a comment number. Retry.'"
- Root cause: read-then-insert numbering; the retry loop hides the race until load.
- Why it gets written: per-parent autoincrement isn't built in, and a retry looks robust.
- Verification: 50 parallel comments give numbers 1..50, no gaps or duplicates, 0 errors.
- Solutions:
  - [best] the number from the insert itself (`(select coalesce(max(n),0)+1 …)` in the INSERT) plus a unique `(event_id, n)` (Drop's fix)
  - [acceptable] a per-event counter row with `UPDATE … RETURNING`
  - [masks-symptom] more retries with jitter
  - [wrong] number comments in the client
- Traps: raises the retry count.
- Evidence: real, Drop `1892ddcc`.
- Difficulty: 2 · Static-detectable: yes
- From: grok C06

### DB8 Pagination done in JavaScript
- Type: A · Class: perf · Primitive: Database · Why: W1, W7
- Fixture: M, `events/index.get.ts`: `const all = await db.select().from(events)`, then filter, slice and `.length`. Seed 50,000 events. 6 lines.
- Report: "Search takes 4 seconds and the server's memory keeps growing."
- Root cause: every row, descriptions included, loads per request.
- Why it gets written: correct on 20 seed rows, and filters are easier in JS.
- Verification: under 150 ms at 50k rows; the logged SQL has `LIMIT`/`OFFSET` and a separate `count()`.
- Solutions:
  - [best] `where` plus `limit`/`offset` plus a parallel `count()` (M)
  - [acceptable] keyset pagination · changes the URL contract
  - [over-engineered] FTS5 for a three-column LIKE
  - [masks-symptom] cache the full list
- Traps: adds `limit` but still loads all rows for the count.
- Evidence: real, rubric B11 failed in 6/15 runs.
- Difficulty: 2 · Static-detectable: yes
- From: grok P02

### DB9 `lower(city)` defeats the index
- Type: both · Class: perf · Primitive: Database · Why: W1
- Fixture: M, `index.get.ts`: ``sql`lower(${events.city}) = lower(${city})` ``; `events_city_starts_at_idx` stays. 1 line.
- Report: "Filtering by city is way slower than the plain list."
- Root cause: a function on the column prevents the index lookup.
- Why it gets written: case-insensitive matching "for free".
- Verification: `EXPLAIN QUERY PLAN` uses `events_city_starts_at_idx`; "berlin" and "Berlin" return the same rows.
- Solutions:
  - [best] normalize the city on write and compare equal, or a `COLLATE NOCASE` column and index
  - [acceptable] an expression index on `lower(city)`
  - [masks-symptom] cache the filtered list
- Traps: adds a second index the query still can't use.
- Evidence: real, rubric B8 failed in 7/15 runs.
- Difficulty: 2 · Static-detectable: yes
- From: grok P03

### DB10 A missing index, fixed without a migration
- Type: both · Class: perf · Primitive: Database migrations · Why: W11
- Fixture: M+ with a "My RSVPs" endpoint and without `rsvps_user_idx` in schema, migration and snapshot; 200,000 RSVPs. The verifier holds a database migrated at the base state, standing in for production.
- Report: "My RSVPs takes 3 seconds for everyone, even people with one RSVP."
- Root cause: `where user_id = ?` scans, because the only index starts with `event_id`.
- Why it gets written: the unique `(event_id, user_id)` index looks like it covers the query.
- Verification: no `SCAN rsvps` in the plan; `db:migrate` works on the production copy and on a fresh database; `db:generate` then produces nothing; migration 0000 byte-identical.
- Solutions:
  - [best] add the index to the schema, generate a new migration, commit both (M declares it at `server/databases/config.ts:76`)
  - [acceptable] a hand-written migration with the snapshot in step
  - [masks-symptom] a per-user cache; a `LIMIT 10` that still scans
  - [wrong] edit `0000_*.sql`; `CREATE INDEX IF NOT EXISTS` at boot
- Traps: edits the schema and stops; tests pass on a fresh database.
- Evidence: real, Drop `1e14bda4`; Drop's plan assertion in `test/cost/round-trips.test.mjs`.
- Difficulty: 3 · Static-detectable: partly
- From: fable P-10

### DB11 Someone edited a migration production applied
- Type: A · Class: bug · Primitive: Database migrations · Why: W11
- Fixture: M: `0001_square_riptide.sql` (the `passkey` table) folded into `0000` and deleted. The verifier holds a database migrated with the original `0000` only.
- Report: "Fresh clones work. Production says no such table: passkey since yesterday's deploy."
- Root cause: production recorded `0000` as applied, so the edited `0000` never runs there.
- Why it gets written: folding migrations looks like tidying, and every fresh database agrees.
- Verification: `db:migrate` on the production copy creates the table and keeps rows; a fresh database migrates; `db:generate` produces nothing; `0000` matches its original hash.
- Solutions:
  - [best] restore `0000` to what production applied and generate `0001` for the rest (Drop's fix)
  - [acceptable] restore `0000` and write `0001` by hand
  - [masks-symptom] run the SQL by hand on production
  - [wrong] delete the migration record; `IF NOT EXISTS` throughout `0000`
- Traps: reproduces on a fresh database and sees nothing.
- Evidence: real, Drop `1e14bda4`.
- Difficulty: 3 · Static-detectable: partly
- From: fable M-02

### DB12 The deploy skips the migrations
- Type: both · Class: bug · Primitive: Database migrations, deploy · Why: W11, W2
- Fixture: L's release script builds and deploys but omits migrations; plus a new additive column. One script line.
- Report: "The deployment was green, but production says the reminders column doesn't exist."
- Root cause: build and deploy don't apply the new migration to the remote database.
- Why it gets written: earlier integrations or a green build imply migrations happened.
- Verification: in a disposable deploy simulation from the previous populated schema, the release applies the migration once; a repeat release applies nothing; a failing migration stops the deploy.
- Solutions:
  - [best] the release applies reviewed migrations to the right database before deploying code (as `site/package.json:9`)
  - [acceptable] separate migrate and deploy CI stages with a required dependency
  - [over-engineered] schema changes on each request
  - [masks-symptom] catch missing-column errors and return empty
- Traps: migrates the local DB only; lets a failed migration continue.
- Evidence: real report nuxt-hub/core#861.
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-26

### DB13 The list ships every column
- Type: both · Class: perf · Primitive: Database, Nuxt payload · Why: W7
- Fixture: M, `events/index.get.ts`: the projected `select({…})` becomes `select()`. Seed 4 KB descriptions. 8 lines.
- Report: "home page feels heavy on my phone. view source is enormous"
- Root cause: the list returns every column (description, organizer id), and `useFetch` copies the response into the HTML payload.
- Why it gets written: `db.select()` is the shortest query, and nothing in dev shows payload size.
- Verification: production build: `__NUXT_DATA__` of `GET /` ≤ 12 KB, `GET /api/events` ≤ 10 KB, neither has `description` or `organizerId`; the page still shows title, city, date and seats.
- Solutions:
  - [best] project the columns in SQL (M `index.get.ts:31-41`)
  - [acceptable] map to a smaller object in the handler · the DB still reads the text
  - [over-engineered] a second endpoint plus a store
  - [masks-symptom] `pick`/`transform` on `useFetch` · the API still sends every column, so the API-bytes check fails
  - [wrong] `server: false` or `lazy`
- Traps: `transform` only; truncation in CSS.
- Evidence: synthetic; plan v2 F1 asks for this budget.
- Difficulty: 2 · Static-detectable: yes
- From: fable P-01 · sol SOL-07

### KV and cache (KV)

### KV1 A single-use code works twice
- Type: both · Class: nook · Primitive: KV · Why: W5, W2
- Fixture: M+ with invite codes for private events: `redeem.post.ts` does `const [, used] = await kv.get(k); if (used) throw 409; await kv.set(k, user.id)`, no `ttl`. About 20 lines. Variant (Grok): EL's push debounce at `991e3a0` (real, 6 lines).
- Report: "One invite code got five people into a private event." Variant: "Bursts of label changes still start several syncs in the same second."
- Root cause: `get`-then-`set` is not atomic, so concurrent requests all see the code unused; the codes also never expire.
- Claim (e): **verified at the pin**. Pin `packages/kv/src/types.ts:142`: "Upstash, Deno KV, and `fs-lite` support it. Cloudflare KV is eventually consistent and returns `KV_UNSUPPORTED_OPERATION`." `runtime/driver.ts:29-32` gives `cloudflare-kv-binding` no `setIfAbsentItem`, and `runtime/storage.ts:126` returns the error. Disagreement: Opus lists database and redis stores as atomic; those drivers don't exist at the pin (`types.ts:4`: `cloudflare-kv-binding`, `deno-kv`, `upstash`, `fs-lite`). At the pin fs-lite also ignores `ttl` (`types.ts:105`); `ae217627b4` (#4226) fixed that after the pin.
- Why it gets written: it is the natural pattern; the docs warn against it, but nothing in the API stops it.
- Verification: 20 parallel redeems of one code give 1 success; after the TTL the code is gone (on Upstash/Deno KV at the pin, or fs-lite on main).
- Solutions:
  - [best] `kv.setIfAbsent(k, userId, { ttl })` (`b8a9a9b409`, #3207, before the pin), on a store that supports it
  - [acceptable] a unique `redemptions(code)` insert with `ON CONFLICT DO NOTHING RETURNING` · works on D1 too; best on Cloudflare
  - [acceptable] `getAndDelete` on Upstash (the only pin driver with it, `driver.ts:32`)
  - [acceptable, variant only] leave EL's debounce racy: its D1 lease (Q8) already serializes syncs, so the debounce only trims load
  - [over-engineered] a Durable Object or a Queue that serializes redemptions
  - [masks-symptom] disable the button
  - [wrong] an in-memory `Set`; `kv.increment` checked `=== 1` without a TTL reset
- Traps: forgets the TTL; a "fix" that is still racy on Cloudflare KV; in the variant, misses that the lease already covers correctness. The NuxtHub migration doc still says fs-lite ignores `ttl`, which main contradicts (doc drift).
- Evidence: real, `b8a9a9b409`, `ae217627b4`; email-labeller `991e3a0`.
- Difficulty: 2-3 · Static-detectable: yes
- From: opus KV1 · grok C08

### KV2 The paid upstream is called per request
- Type: A · Class: perf · Primitive: Nitro cache · Why: W1
- Fixture: M, `server/api/rates.get.ts`: a plain `fetch` with no cache and no timeout. The rates stub sleeps 4 s and counts hits. 8-10 lines.
- Report: "The event page takes 4 seconds. And the rates provider says we call them 10k times a day."
- Root cause: an uncached, untimed upstream call on every render.
- Why it gets written: a one-line fetch, and nobody tests with a slow upstream.
- Verification: 20 page loads, 1 upstream hit (plan v2 F7: ≤ 1 call in 10 minutes over 50 requests); with a never-answering upstream on a cold cache, pages answer in under 3 s with euro prices (rubric C2).
- Solutions:
  - [best] `defineCachedFunction(…, { maxAge: 3600, swr: true })` from `nitro/cache`, `AbortSignal.timeout`, euro fallback, with `vitehub: { cache: true }` (M `rates.get.ts`)
  - [acceptable] a route rule `cache: { maxAge }` on `/api/rates` · no timeout unless added; KV with a TTL by hand
  - [over-engineered] a Schedule that pre-fetches into KV
  - [masks-symptom] fetch rates in the browser after load; `localStorage`
  - [wrong] a module variable with no TTL (KV3)
- Traps: caches without a timeout (a cold cache still hangs); a timeout without a fallback; forgets `swr`.
- Evidence: real, rubric C1 failed 7/15 and C2 12/15 graded runs.
- Difficulty: 2 · Static-detectable: partly
- From: opus KV2 · grok P04

### KV3 A hand-rolled rates cache stampedes
- Type: both · Class: perf · Primitive: Nitro cache, KV · Why: W5, W2
- Fixture: M, `rates.get.ts`: `if (!cached || Date.now() - at > TTL) cached = await fetchRates()` in module variables; the stub takes 2 s. Config variant (Sol): keep `defineCachedFunction` but drop `vitehub: { cache: true }`, on 3 instances. 1-10 lines.
- Report: "The rates bill tripled. Their dashboard shows bursts of 40 calls in the same second, at the top of every hour." Variant: "Every fresh worker seems to call the provider again."
- Root cause: an `await` sits between the check and the assignment, so each request during a refresh starts its own call; the cache also belongs to one process.
- Why it gets written: a module variable is the first cache anyone writes, and dev requests never overlap.
- Verification: 50 concurrent requests on a cold cache, 1 stub hit; after the TTL, 50 more, 1 more hit; two instances plus a restart don't refetch while fresh.
- Solutions:
  - [best] `defineCachedFunction(fn, { maxAge, swr: true })` with a timeout and the shared store (M). ocache keeps one pending call per key (`ocache/dist/index.mjs:494-611`, verified)
  - [acceptable] cache the promise, not the value · no stampede, still per process
  - [acceptable] a KV value refreshed by a Schedule
  - [over-engineered] a KV lock with retries
  - [masks-symptom] a longer TTL
  - [wrong] a bigger `maxAge` on a per-instance cache, promised as shared
- Traps: adds a timeout, sees one request work, keeps the race.
- Evidence: synthetic; plan v2 F7; ViteHub cache integration `c5a912e5d9` (per Sol).
- Difficulty: 3 · Static-detectable: yes
- From: fable P-05 · opus KV2 (variant) · sol SOL-23

### KV4 A memoized promise keeps its rejection
- Type: both · Class: bug · Primitive: none (a pattern ViteHub had in 16 places) · Why: W10
- Fixture: M: a rates client memoized as `client ??= connect()`, where `connect()` fetches a token. About 10 lines.
- Report: "After yesterday's outage at the rates provider, prices stayed in euros until we restarted the server."
- Root cause: the memoized promise keeps its rejection forever.
- Why it gets written: `??=` on a promise is idiomatic and looks right.
- Verification: the first call fails (mocked), the second succeeds.
- Solutions:
  - [best] clear the memo on rejection: `x ||= load().catch(e => { x = undefined; throw e })` (`52f15464c0`)
  - [acceptable] connect per call
  - [over-engineered] a circuit-breaker library
  - [masks-symptom] a scheduled restart
  - [wrong] catch and resolve `undefined` forever
- Traps: retries inside `connect()` but keeps the rejected memo.
- Evidence: real, ViteHub `52f15464c0` (#3986, 16 places).
- Difficulty: 2 · Static-detectable: yes
- From: opus KV3

### KV5 A cache shows one user's data to another
- Type: both · Class: security · Primitive: Nitro cache, Auth · Why: W10
- Fixture: M, `[slug]/index.get.ts`: the body wrapped in `defineCachedFunction(async (slug, userId) => …, { getKey: slug => slug, maxAge: 60 })`; the cached value carries `going` and `isOrganizer`. Variant: a "My RSVPs" helper cached the same way. 6-15 lines.
- Report: "Sometimes I see an Edit button on events that aren't mine, and it says I'm going to events I never RSVP'd to."
- Root cause: the key covers the slug only, but the value depends on the user.
- Why it gets written: the cities cache (`cities.get.ts:7-12`) is the pattern to copy. An author who first tries `defineCachedHandler` sees "signed out for everyone" (it strips cookies) and moves to a cached function, which strips nothing.
- Disagreement resolved: Opus planted `defineCachedEventHandler` with `requireUser` inside. Nitro 3.0.261103-rc exports only `defineCachedHandler` and `defineCachedFunction` from `nitro/cache` (`nitro/dist/runtime/cache.d.mts:1-2`, verified), and cached handlers strip request cookies by default and remove `Set-Cookie` (`ocache/dist/index.d.mts:445-449`, verified). That plant gives 401 to everyone, not a leak. The leak needs a cached function keyed without the user (Grok, Sol).
- Verification: A loads the page, then B within 60 s: B's `isOrganizer` is false and `going` is B's; the public part still hits the DB at most once per slug per minute. Check HTML and payload.
- Solutions:
  - [best] cache only the public part keyed by slug; add `going` and `isOrganizer` per request
  - [acceptable] no cache, the reads in `Promise.all` (M) · already fast
  - [acceptable] `userId` in `getKey` · correct, one entry per user per event
  - [over-engineered] client-side caching with a store
  - [masks-symptom] `maxAge: 5`
  - [wrong] `defineCachedHandler` with `varies: ['cookie']` · per-cookie entries of personal data
- Traps: removes the cache and keeps the leak in another helper; misses that `seatsLeft` is now stale.
- Evidence: real, ViteHub `7ff101f2c7` (#3987, after the pin: the build fails when an Auth-guarded route is cached); the plant is synthetic.
- Difficulty: 3 · Static-detectable: yes
- From: opus AU3 · grok S06 · sol SOL-14

### KV6 A cached handler ignores the query
- Type: A · Class: nook · Primitive: Nitro v3 cache · Why: W8, W10
- Fixture: M, `events/index.get.ts` wrapped in `defineCachedHandler(handler, { maxAge: 30 })`. 2 lines.
- Report: "Since we added caching, search doesn't work and page 2 is the same as page 1."
- Root cause: Nitro v3's cached handlers pass no query parameters to the handler or the key by default.
- Claim (b): **verified**. `nitro@3.0.261103-rc` depends on `ocache ^0.3.1` (`package.json:83`), installed as 0.3.1. `ocache/dist/index.d.mts:437`: "By default, no query parameters reach cacheable handlers or vary the key. Set to `true` to opt the full query string back in. A custom `getKey` replaces key generation but does not disable URL filtering." `index.mjs:952` builds `allowedQueryNames` from `allowQuery`.
- Why it gets written: Nitro 2's `cachedEventHandler` keyed by the full URL, and old posts teach it.
- Verification: `?page=2` and `?q=rust` return different items with the cache on; repeats are hits.
- Solutions:
  - [best] `allowQuery: ['q', 'city', 'page']`
  - [acceptable] `allowQuery: true` · arbitrary queries create entries
  - [acceptable] drop the cache; the query is indexed and fast
  - [wrong] a `getKey` built from the URL · still filtered
- Traps: the `getKey` route.
- Evidence: real, nitrojs/nitro#5000 ("define global allowQuery / varies"); ocache docs above.
- Difficulty: 3 · Static-detectable: yes
- From: grok P08

### KV7 A search cache that never forgets
- Type: both · Class: perf · Primitive: Nitro cache · Why: W10
- Fixture: M, `events/index.get.ts`: `const cache = new Map()` keyed by the raw query string, no expiry. 8 lines.
- Report: "The server gets killed for memory every couple of days. Also someone saw seats on an event that was full."
- Root cause: a per-process Map keyed by anything a visitor types grows without bound and returns seat counts from the first time a key was seen.
- Why it gets written: a Map is the fastest patch for a slow search.
- Verification: `--max-old-space-size=128`, 30,000 distinct queries: the process stays up, RSS under 300 MB; an RSVP then the same query shows one seat fewer.
- Solutions:
  - [best] delete the cache · the query is indexed and paged
  - [acceptable] `defineCachedFunction` with a short `maxAge` on a normalized key, for the user-independent part
  - [over-engineered] an LRU dependency with invalidation on every RSVP
  - [masks-symptom] clear hourly, restart nightly, raise the memory limit
- Traps: bounds the cache and keeps stale seats; the report's second sentence is the tell.
- Evidence: synthetic; Drop `1892ddcc`, babysitter `6e25c2444` (class).
- Difficulty: 2 · Static-detectable: yes
- From: fable P-12

### KV8 An activity feed kept in one KV value
- Type: both · Class: perf · Primitive: KV, Database · Why: W5, W7
- Fixture: M+ with an organizer activity feed: each RSVP does `kv.get("activity:<eventId>")`, pushes, `kv.set`. Seed 20,000 entries (about 1.5 MB). 15 lines.
- Report: "RSVPing to the big conference takes 2 seconds; small events are instant. And names are missing from the feed."
- Root cause: every RSVP reads, parses and rewrites the whole list, and concurrent RSVPs each write back their own copy.
- Why it gets written: a get/set API invites storing the array.
- Verification: RSVP latency at 20,000 entries within 1.5× of 10 entries; 50 concurrent RSVPs add 50 entries; no KV value over 64 KB.
- Solutions:
  - [best] read the feed from `rsvps`, which has user and `createdAt` · no second store
  - [acceptable] an indexed `activity` table; one KV key per entry under a prefix
  - [over-engineered] a Queue job that appends
  - [masks-symptom] keep the last 100 · bounded, still loses concurrent writes
- Traps: fixes size, misses the lost update.
- Evidence: synthetic; babysitter `70a0c2fde`, ViteHub #2519 (class).
- Difficulty: 3 · Static-detectable: yes
- From: fable P-13

### Rate limit (RL)

### RL1 The rate limit never trips
- Type: both · Class: nook · Primitive: Rate-limit · Why: W4, W12
- Fixture: M, `rsvp.post.ts:11`. Three forms, one per run (or all three in B): `if (!(await checkRateLimit(event.req, 'rsvp', opts))) throw 429`; `requireRateLimit(…)` without `await`; a memory limiter built inside the handler. 1-3 lines each.
- Report: "Someone RSVP'd and cancelled 3,000 times in a minute. Doesn't the limit do anything?"
- Root cause: the check's result is always truthy, the unawaited guard checks nothing, or the per-request limiter starts from zero.
- Disagreement resolved: Opus says `checkRateLimit` returns a tuple. At the pin it returns `Promise<RateLimitDecision>` (pin `packages/rate-limit/src/guard.ts:135`, verified); the tuple came with `43128a213e` after the pin. Both shapes are always truthy, so the plant works either way; the explanation must match the pin.
- Why it gets written: boolean-looking APIs. Doctor VHUB0006, VHUB0008 and VHUB0009 name all three (pin `docs/content/docs/reference/doctor-rules.md:65-68`, verified), so this is the linter-visible tier.
- Verification: 21 requests in a minute; the 21st gets 429.
- Solutions:
  - [best] `await requireRateLimit(event.req, name, opts)` (pin `guard.ts:139`; M)
  - [acceptable] check `decision.allowed` (or destructure the tuple on main)
  - [over-engineered] a hand-written KV counter
  - [masks-symptom] a client throttle
  - [wrong] lower `limit`; `if (decision)`
- Traps: finds one form and stops; lowers the limit.
- Evidence: real, `43128a213e`, `49f1002aaa`.
- Difficulty: 1 · Static-detectable: yes (Doctor)
- From: opus RL1 · fable N-02 · opus B-only 14

### RL2 Behind a proxy, everyone is one client
- Type: A · Class: nook · Primitive: Rate-limit, Auth · Why: W2, W9
- Fixture: M behind nginx with proxy trust off; the test client goes through one proxy address. Config only.
- Report: "Since we moved behind nginx, lots of people get 'Too many attempts' when they sign in."
- Root cause: with no `key`, limits count by the address the host reports, which is the proxy's; Better Auth's limiter does the same unless `advanced.trustedProxyHeaders` is set (M `server/auth.ts`).
- Why it gets written: works in dev; the proxy changes the peer address.
- Verification: two clients through one proxy with different `X-Forwarded-For` have separate counters; a spoofed header sent straight to the app doesn't reset a counter.
- Solutions:
  - [best] trust the proxy explicitly: `NUXT_TRUST_PROXY=true` for Better Auth (M) plus ViteHub's proxy trust
  - [acceptable] key app limits by user id or email
  - [over-engineered] a rate-limit service at the proxy
  - [masks-symptom] raise the limits
  - [wrong] key on a client-sent `x-forwarded-for` without trusting a proxy (RL3)
- Traps: reads `x-forwarded-for` directly.
- Evidence: real, M's comments; ViteHub `7e659657dc` (#4245, anonymous Agent callers shared one counter).
- Difficulty: 3 · Static-detectable: partly
- From: opus RL2

### RL3 The limit is keyed on a spoofable header
- Type: both · Class: security · Primitive: Rate-limit · Why: W9
- Fixture: M: the RSVP and sign-up limits use `key: event.req.headers.get("x-forwarded-for") ?? "anon"`. 1 line.
- Report: "A bot made 3,000 accounts last night. We have a rate limit!"
- Root cause: the client chooses the key; without the header everyone shares `"anon"`.
- Why it gets written: "rate limit per IP" and the IP "is" X-Forwarded-For in every post. ViteHub's default key is the host's client address (pin `guard.ts:77-80,120-122`, per Grok), so a hand-picked key makes it worse.
- Verification: a burst with rotating `X-Forwarded-For` still gets 429; client B isn't blocked by client A (rubric A7).
- Solutions:
  - [best] no `key` on anonymous routes, `user.id` on signed-in ones
  - [acceptable] read XFF only behind a configured trusted proxy
  - [over-engineered] a Redis limiter
  - [wrong] key on `user-agent`
- Traps: keeps the shared `"anon"` fallback.
- Evidence: real, rubric A7 failed in 8/15 runs (`20261109-1632-meetups-v2-codex-a1`: "all clients share one bucket").
- Difficulty: 2 · Static-detectable: yes
- From: grok S14

### Realtime (RT)

### RT1 Signed in can write any document
- Type: both · Class: security · Primitive: Realtime, Auth · Why: W12
- Fixture: V, a small notes app (Console shape) at the pin: `defineRealtime({ auth: true, document: … })` with no `authorize`. About 20 lines.
- Report: "A coworker edited my private note."
- Root cause: signed in is not authorized; with no per-document rule any user opens any room for writing.
- Why it gets written: `auth: true` reads like access control.
- Verification: user B's WebSocket to A's private document is refused or read-only.
- Solutions:
  - [best] `authorize: ({ user, documentId, mode }) => …` with an ownership check
  - [acceptable] one document namespace per user
  - [over-engineered] a proxy re-checking every Yjs update
  - [masks-symptom] unguessable document ids
  - [wrong] check only in the page
- Traps: checks only in the UI.
- Evidence: real, ViteHub `d82121cb6c` (#4294, after the pin: before it, a definition with no rule let anyone read and overwrite every document). On main the plant fails validation, so this case must stay at the pin.
- Difficulty: 3 · Static-detectable: yes
- From: opus RT1

### Agent (AG)

### AG1 A child hook replaces the preset's hook
- Type: A · Class: nook · Primitive: Agent (hooks, presets), Channels · Why: W12
- Fixture: EL at `b2b6f33^` (real): `server/lib/replay.ts` defines its own `agent:finish` hook on top of the labeller preset. About 25 lines.
- Report: "Backfill says it labelled 200 emails but none have labels in Gmail."
- Root cause: ViteHub merges Agent hooks as `{ ...parent, ...child }`, so the child's hook replaced the preset's, which applies the labels.
- Why it gets written: layered config looks additive, and Nuxt and Nitro hooks chain.
- Verification: after a backfill the mocked channel gets `modify` calls equal to the decisions.
- Solutions:
  - [best] call the preset's hook from the child (`labeller.hooks?.['agent:finish']`, the real fix)
  - [acceptable] collect decisions from the journal or another hook name
  - [over-engineered] fork the preset
  - [masks-symptom] apply labels in a second pass
  - [wrong] remove the replay hook (loses the report); re-implement labelling in replay
- Traps: debugs Gmail auth.
- Evidence: real, email-labeller `b2b6f33` (its message names the spread merge). The merge site in ViteHub was not found on main by either seat (unverified).
- Difficulty: 3-4 · Static-detectable: partly
- From: opus AG1 · grok N02

### Env and config (EN)

### EN1 A sealed secret is sent as redacted text
- Type: both · Class: nook · Primitive: Env · Why: W12
- Fixture: M: the rates key as `env({ secret: true, source: env.source('RATES_API_KEY') })`, read through the server env, sent as `` `Bearer ${env.rates.apiKey}` ``. About 5 lines.
- Report: "Prices show in euros only in production, and the rates provider logs 401s from us."
- Root cause: a sealed secret interpolates as a redacted string, so the header carries the redaction.
- Why it gets written: it looks like a string, and nothing complains at runtime.
- Verification: the rates stub receives the real token. Static: Doctor VHUB0004 `vitehub/unseal-secret-env` (pin `doctor-rules.md:63`, verified).
- Solutions:
  - [best] `.unseal()` at the call site (pin `packages/env/src/secret.ts:10`, verified), never logged
  - [acceptable] Nuxt server `runtimeConfig`, as M does
  - [over-engineered] a secrets manager client
  - [masks-symptom] hard-code the key in a file read directly
  - [wrong] `process.env` in the Vite config, which bakes the key into the build (VHUB0005)
- Traps: logs the key to debug it.
- Evidence: real, Doctor rules `49f1002aaa`; `1ab2fa54d9` (#4258).
- Difficulty: 2 · Static-detectable: yes (Doctor)
- From: opus EN1

### EN2 The API key ships to the browser
- Type: both · Class: security · Primitive: Env, runtimeConfig · Why: W3
- Fixture: M: `runtimeConfig.public.ratesApiKey`, and `app/plugins/rates.ts` calls the provider from the browser. Variant: `import.meta.env.VITE_RATES_KEY`. 5-10 lines.
- Report: "Our exchange-rate bill went up 40× this month and we didn't get more traffic."
- Root cause: a secret in public config or a `VITE_` variable is serialized into `__NUXT__` and the bundle.
- Why it gets written: a universal plugin reads a server-only key as empty in the browser, and `public` is the quickest "fix"; `VITE_` looks like a naming habit.
- Verification: `.output/public` and the SSR HTML hold 0 copies of the key; rates still convert; ≤ 1 upstream call in 10 minutes (F7).
- Solutions:
  - [best] a server route with `defineCachedFunction`, the key in private `runtimeConfig` or `env({ secret: true })` (M `rates.get.ts`)
  - [acceptable] a server proxy without a cache · fixes the leak, keeps the cost
  - [over-engineered] a separate rates service
  - [masks-symptom] rotate the key; obfuscate it
  - [wrong] move it to `.env` and keep it under `public`
- Traps: rotates and stops.
- Evidence: real, rubric X1 (0/15: agents get it right greenfield, so it is a B plant first); Doctor `nuxt/runtime/no-secret-in-public-config` (vite-doctor 0.1.2, per Grok).
- Difficulty: 1 · Static-detectable: yes (Doctor)
- From: opus NX5 · grok S04

### Performance, not tied to a primitive (PF)

### PF1 A heavy library in every route's chunk
- Type: A · Class: perf · Primitive: Nuxt code splitting · Why: W7
- Fixture: M+ with a chart package on the dashboard and `app/plugins/charts.ts` registering it globally (10 lines). Large-app form: DR at `6b331bbd^`, where `useLiveEditor` imports Tiptap, ProseMirror, Yjs and the room at the top of a composable the reader page uses.
- Report: "lighthouse says the home page downloads 400 KB of javascript it never uses." DR: "shared docs load slowly on phones, and most visitors only read."
- Root cause: a static import in code every route loads puts the library in the entry chunk.
- Why it gets written: global registration is the documented way for many Vue libraries; a composable's imports are static unless someone makes them dynamic.
- Verification: build and read the client manifest: no module of the package in the entry chunk or `/`'s static imports; total JS within 5% of the base without it; the dashboard or editor still works. DR: the shared-doc route's static JS drops ≥ 25%, no Tiptap/ProseMirror/Yjs in its static graph. One build per run (about 2.5 GB).
- Solutions:
  - [best] import the library where it's used (the dashboard component); in DR, load the editor and room on open (the commit)
  - [acceptable] a `Lazy` component or `defineAsyncComponent`; dynamic `import()` on mount
  - [over-engineered] replace the package with a hand-drawn chart
  - [masks-symptom] `<ClientOnly>` (still in the entry chunk); preload hints
  - [wrong] a `manualChunks` rule (the page still preloads it); `ssr: false`
- Traps: checks the dashboard and never measures `/`; a dynamic import that still pulls Yjs through a shared module.
- Evidence: real, Drop `6b331bbd` ("cuts the page's up-front JS by about a third"); plan v2 F8; the M plant is synthetic.
- Difficulty: 2 (M), 3 (DR) · Static-detectable: yes
- From: fable P-02 · fable D-03

### PF2 The server takes ten seconds to boot
- Type: A · Class: perf · Primitive: Nitro plugins · Why: W1
- Fixture: M, new `server/plugins/warm.ts`: at boot it scans every event for the city list, renders three email templates and calls the rates service; the stub hangs 4 s. 25 lines.
- Report: "After every deploy the site is down for about 10 seconds. The health check fails and the host restarts it, sometimes twice."
- Root cause: Nitro plugins finish before the server takes requests, and this one awaits a table scan and an outbound call.
- Why it gets written: warming at startup is a long-lived-server habit; in dev the process never restarts.
- Verification: spawn `node .output/server/index.mjs` with the hung stub: first 200 on `/api/cities` within 1,500 ms [G]; the stub sees no request before the first inbound one; the second `/api/cities` answers under 50 ms.
- Solutions:
  - [best] delete the warm-up; compute on first use behind `defineCachedFunction` (M `cities.get.ts:7-12`, `rates.get.ts`)
  - [acceptable] start the warm-up without awaiting it, catch its errors
  - [over-engineered] a Schedule that refreshes a KV copy
  - [masks-symptom] raise the health-check timeout
  - [wrong] move the awaits into a middleware
- Traps: measures request latency and never restarts the server.
- Evidence: synthetic; the class is in ViteHub `1e807fc` itself ("load the registry definitions on the first run", #3679).
- Difficulty: 3 · Static-detectable: partly
- From: fable P-03

### PF3 A CSV export freezes the site
- Type: A · Class: perf · Primitive: h3 response · Why: W1
- Fixture: M, `attendees.csv.get.ts`: the date cell builds a `new Intl.DateTimeFormat(…)` per row; one event has 150,000 attendees. 3 lines.
- Report: "When the conference organizer downloads the attendee list, the whole site hangs for everyone for a few seconds."
- Root cause: constructing a formatter per row is seconds of synchronous work on the one thread that serves every request.
- Why it gets written: inline formatting reads well and ten seed rows take no time.
- Verification: during an export, 200 requests to another event's `/seats` have p95 ≤ 100 ms; the export finishes under 2 s [G]; the CSV bytes equal the base's.
- Solutions:
  - [best] one formatter outside the loop, or `toISOString()` as M does (line 18) · one line
  - [acceptable] stream rows in pages · bounds memory, more code than the report needs
  - [over-engineered] a Queue job that writes the file to Blob and mails a link
  - [masks-symptom] yield every 1,000 rows · others get through, the export is as slow
  - [wrong] cache the CSV
- Traps: reaches for streaming or a job first. This case ranks a one-line fix above a correct larger one.
- Evidence: synthetic; babysitter `164146e12` (class).
- Difficulty: 3 · Static-detectable: partly
- From: fable P-04

### PF4 Every card polls once a second
- Type: A · Class: perf · Primitive: Nuxt (Realtime as the trap) · Why: W7
- Fixture: M, `EventCard.vue` gets a copy of the event page's seat refresher at 1 s with no visibility check. 12 lines.
- Report: "Server CPU is pinned whenever a few people leave the home page open. The access log is all /seats."
- Root cause: 24 cards each poll once a second per tab, hidden tabs included.
- Why it gets written: the pattern works on the event page, so someone copies it.
- Verification: Playwright on `/` for 20 s sees ≤ 1 `/seats` request; a hidden tab makes 0; on the event page a second browser's RSVP still shows within 10 s (rubric P14).
- Solutions:
  - [best] remove the poll from the card (the list already has `seatsLeft`), keep the page's visible-only 5 s poll (M `RsvpPanel.vue:25-29`)
  - [acceptable] one batched request for visible cards, paused when hidden; one SSE stream per page
  - [over-engineered] WebSockets or ViteHub Realtime · Realtime "is not a general-purpose WebSocket or event-broadcasting API" (pin `packages/realtime/README.md:12`, per Fable)
  - [masks-symptom] a 10 s interval; a 1 s cache on `/seats`
- Traps: reaches for Realtime because "live".
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: yes
- From: fable P-06

### Nuxt rendering, state, data (SSR)

### SSR1 Request data in module scope
- Type: both · Class: security · Primitive: Nuxt state, h3 · Why: W3
- Fixture: M. App form: `app/composables/useAuth.ts` keeps `const user = ref<SessionUser | null>(null)` at module scope instead of `useState` (M `useAuth.ts:16`). Server form (Grok): `server/utils/session.ts` gets `let current`, set by a middleware and read in `dashboard.get.ts`; the session store waits 15 ms so requests interleave. 1-8 lines.
- Report: "For a second after the page loads I see another person's name in the header." Server form: "Twice my dashboard showed somebody else's events."
- Root cause: process-wide state holds per-request identity and is shared by concurrent SSR requests.
- Why it gets written: module scope is normal in a SPA, and with one tester an in-memory store finishes in microtasks, so the value never shows another user (findings-v4).
- Verification: 50 rounds of two concurrent requests with different cookies behind barriers, plus two sequential requests on one warm worker: each HTML, payload and JSON holds only its own identity.
- Solutions:
  - [best] `useState` in the composable (M); on the server, read the session per request (`requireUser(event)`)
  - [acceptable] `provide`/`inject` per app instance; `event.context.user` set per request
  - [over-engineered] a Pinia store for one value; AsyncLocalStorage plumbing; a global map keyed by cookie
  - [masks-symptom] `<ClientOnly>` around the name
  - [wrong] reset the module value per request · overlapping requests still race
- Traps: `ClientOnly`; flags every module singleton (immutable schemas, public config) in B; `useState` on the server side.
- Evidence: real, nuxt/nuxt#19623; rubric A11/S2; Doctor `nuxt/ssr/no-module-scope-request-state` (per Grok).
- Difficulty: 2-3 · Static-detectable: yes (Doctor)
- From: opus NX1 · sol SOL-08 · grok S05

### SSR2 Times render differently on server and client
- Type: both · Class: bug · Primitive: Nuxt SSR, Intl · Why: W3
- Fixture: M. `EventStart.vue`: `<NuxtTime>` replaced by `new Date(startsAt).toLocaleString()` and a hand-rolled "in 3 hours". `EventCard.vue` (Grok): `const started = computed(() => new Date(startsAt) <= Date.now())` switches the RSVP button, plus `new Date().getFullYear()` in the footer. 2-8 lines.
- Report: "The time on event pages jumps after load, the console has warnings, and sometimes the RSVP button flips from 'Started' to 'RSVP'."
- Root cause: server and browser format or compare at different instants and in different zones.
- Why it gets written: `toLocaleString` and `Date.now` look deterministic in one dev browser.
- Verification: Playwright, server UTC, browser America/Los_Angeles, clock pinned 1 s before start and near midnight and a DST change: 0 hydration warnings (rubric H2, F3); the visitor-local date stays right.
- Solutions:
  - [best] `<NuxtTime>` for display (M `EventStart.vue`), and the server decides `started` and the payload carries it (M `[slug]/index.get.ts:32-33`)
  - [acceptable] `useState('now', () => Date.now())`; client-render only the relative fragment with a stable SSR fallback
  - [over-engineered] a date library plus a custom directive; a time service
  - [masks-symptom] `<ClientOnly>`, `data-allow-mismatch`, suppressed warnings
  - [wrong] pass the server's zone to the client; set the server TZ globally
- Traps: `ClientOnly` everywhere, which shifts layout; tests only daytime.
- Evidence: real, rubric H5 failed in 12/15 graded runs; Doctor `noRandomOrLocalTimeRender` (per Grok). Decoy DC13 is the safe server-decided form.
- Difficulty: 2 · Static-detectable: yes
- From: opus NX2 · sol SOL-09 · grok T02

### SSR3 The venue time is read in the server's zone
- Type: both · Class: bug · Primitive: none (time) · Why: W1, W3
- Fixture: M, `events/index.post.ts`: `startsAt: new Date(startsAtLocal)` with `zonedLocalToInstant` removed. Server in UTC, venue in Madrid. 1 line. (Family note: no family fits a time bug; it sits with SSR2.)
- Report: "Events created from Spain show up an hour or two early for everyone."
- Root cause: a `datetime-local` string parses in the server's zone, not the venue's.
- Why it gets written: `new Date("2026-12-01T18:30")` works on a laptop in the venue's zone.
- Verification: TZ=UTC server; `18:30 Europe/Madrid` on a winter and a summer date gives `17:30Z` and `16:30Z`; a nonexistent spring-forward time is refused (rubric T1).
- Solutions:
  - [best] convert with the event's IANA zone (M `shared/utils/time.ts:24-34`) or Temporal
  - [acceptable] send the browser's instant · only right when the browser is in the venue's zone
  - [wrong] a fixed offset
- Traps: the browser-instant fix, which breaks for a travelling organizer.
- Evidence: real, rubric T1 failed in 7/15 graded runs.
- Difficulty: 3 · Static-detectable: yes
- From: grok T01

### SSR4 The SSR fetch drops the session cookie
- Type: both · Class: bug · Primitive: Nuxt data fetching, Auth · Why: W3
- Fixture: M, the account page or session plugin: request-aware fetching replaced by plain `$fetch` to an internal route. 1-3 lines.
- Report: "I'm signed in, but opening my bookings in a new tab says I'm logged out. Clicking around fixes it."
- Root cause: the server-side `$fetch` doesn't carry the visitor's cookie; client navigation does.
- Why it gets written: `$fetch` looks universal; forwarding request identity in SSR is a separate concern.
- Verification: SSR HTML as Alice and as Bob shows each identity; anonymous API stays 401; no compensating client session request; no cookie reaches the external rates host.
- Solutions:
  - [best] relative `useFetch`, or `useRequestFetch` captured in setup (M `plugins/session.ts`)
  - [acceptable] forward only the cookie to the trusted internal route
  - [over-engineered] an auth proxy service
  - [masks-symptom] disable SSR for the area
- Traps: forwards every header to external URLs; removes the API guard; reads the 401 as an expired session.
- Evidence: real, nuxt/nuxt#24813; Nuxt data-fetching docs.
- Difficulty: 2 · Static-detectable: yes
- From: sol SOL-01

### SSR5 A setup `$fetch` runs twice
- Type: both · Class: perf · Primitive: Nuxt payload · Why: W3
- Fixture: M, the event list: top-level `await $fetch('/api/events')` in setup. 2-4 lines.
- Report: "Opening the events page makes two API calls and the list flashes."
- Root cause: setup runs on server and client, and nothing carries the result through the payload.
- Why it gets written: an awaited fetch returns data during SSR, so the missing handoff is easy to miss.
- Verification: one SSR load plus hydration hits the list handler once and the browser makes 0 list calls before interaction; a filter change fetches once.
- Solutions:
  - [best] `useFetch` or `useAsyncData`
  - [acceptable] explicit request-scoped state and payload transfer
  - [over-engineered] a browser cache library and a service worker
  - [wrong] `onMounted` as the only loader
- Traps: wraps a mutation in the initial data handler.
- Evidence: synthetic; Nuxt docs describe the double fetch.
- Difficulty: 1 · Static-detectable: yes
- From: sol SOL-02

### SSR6 Two cards share one async-data key
- Type: both · Class: bug · Primitive: Nuxt `useAsyncData` · Why: W12
- Fixture: M, side-by-side event previews: the same explicit key for different ids. 1-2 lines.
- Report: "Sometimes the second event shows the first one's attendees."
- Root cause: calls with one key share refs even when they fetch different data.
- Why it gets written: a key looks like a label, but it defines shared state.
- Verification: render two ids together, navigate between ids, change city and currency: each view shows its own data without a reload.
- Solutions:
  - [best] keys from every input that defines the resource
  - [acceptable] drop the explicit key where the pin generates distinct ones (check navigation)
  - [over-engineered] a global entity store
  - [wrong] a random key per render
- Traps: changes the URL and leaves layout consumers on the colliding key. Auto-key behaviour varies by Nuxt version (Sol); check at the pin.
- Evidence: synthetic; `useAsyncData` docs.
- Difficulty: 2 · Static-detectable: yes
- From: sol SOL-03

### SSR7 A manual watcher doubles every filter request
- Type: both · Class: perf · Primitive: Nuxt `useFetch` · Why: W7
- Fixture: M search: reactive query options kept, plus a delayed manual watcher that calls `refresh`. 3-6 lines.
- Report: "Typing a city hits our API twice. The loading spinner keeps restarting."
- Root cause: automatic option watching and a manual refresh both own the update.
- Why it gets written: a Vue watcher carried into `useFetch` without its auto-refetch in mind.
- Verification: a fixed filter sequence plus Back/Forward gives one final request per committed interaction, including empty query and page reset.
- Solutions:
  - [best] one reactive request definition, no manual refresh
  - [acceptable] `watch: false` with explicit debounce and refresh
  - [over-engineered] an app-wide request scheduler
  - [masks-symptom] a longer debounce
- Traps: claims `dedupe: 'defer'` fixes staggered duplicates; breaks URL sync.
- Evidence: synthetic; `useFetch` docs.
- Difficulty: 2 · Static-detectable: yes
- From: sol SOL-04

### SSR8 An older search result wins
- Type: both · Class: bug · Primitive: Nuxt `useAsyncData`, AbortSignal · Why: W5
- Fixture: M, a custom search composable: cancellation and generation guard removed from an async watcher. 3-8 lines.
- Report: "I search for Paris, change it to London, and Paris comes back after London loads."
- Root cause: an older response commits after a newer one.
- Why it gets written: dedupe, abort and "which result may update the UI" are different contracts.
- Verification: hold Paris behind a barrier, resolve London, release Paris: UI and URL stay London, with no timing race in the test.
- Solutions:
  - [best] the Nuxt data API with its signal passed to `$fetch`, latest-result shown by test
  - [acceptable] an AbortController plus a request generation counter
  - [over-engineered] a server-side search queue
  - [wrong] `dedupe: 'defer'` and assume the last query ran
- Traps: tests only the final state after a sleep; assumes nuxt/nuxt#36893 is fixed at the pin.
- Evidence: real report nuxt/nuxt#36893 (framework side); the app-level plant is synthetic. Calibrate at the pin.
- Difficulty: 4 · Static-detectable: partly
- From: sol SOL-05

### SSR9 Search fires a request per keystroke
- Type: A · Class: perf · Primitive: Nuxt `useFetch` · Why: W7
- Fixture: M, `index.vue`: `v-model="q"` bound straight into `useFetch`'s reactive query. 2 lines.
- Report: "Typing in search makes the list flicker and our API logs show a request per letter."
- Root cause: a reactive query with no debounce and no URL sync.
- Why it gets written: refetch on change is the feature that makes `useFetch` look easy.
- Verification: typing "berlin" gives ≤ 2 requests and the URL holds `?q=berlin` (rubric D5).
- Solutions:
  - [best] a debounced write to the route query, `useFetch` on the route (M `index.vue`)
  - [acceptable] `refDebounced` feeding `useFetch`
  - [masks-symptom] fetch on submit only (a product change)
- Traps: debounces and leaves the URL stale.
- Evidence: real, rubric D5 failed in 5/15 runs.
- Difficulty: 1 · Static-detectable: yes
- From: grok P10

### SSR10 A watcher outlives its component
- Type: B · Class: perf · Primitive: Vue effect scopes · Why: W3
- Fixture: V: a lazy session widget creates a watcher inside a promise callback, outside setup's synchronous scope. 5-10 lines.
- Root cause: the watcher has no owner scope, so it keeps running after unmount or is installed after the component is gone.
- Why it gets written: lazy imports move hook setup into a promise continuation; Vue disposes watchers only in their scope.
- Verification (outside B): mount and unmount 50 times, including unmount before the import resolves; mutating the session source runs 0 callbacks for dead instances and 1 for the live one.
- Solutions:
  - [best] create the watcher synchronously and gate its work on readiness
  - [acceptable] capture the owner scope and register there if still active
  - [over-engineered] a global widget registry with a sweeping timer
  - [wrong] a DOM-existence check inside each leaked callback
- Traps: flags every top-level `await` in `<script setup>`.
- Evidence: real, Drop `f949cdb7` (`patches/@vite-hub__auth@0.0.4.patch`, scope preservation); Vue watcher docs.
- Difficulty: 4 · Static-detectable: yes
- From: sol SOL-10

### SSR11 Two Vue runtimes break UI slots
- Type: A · Class: dx · Primitive: Vue, UI, package resolution · Why: W8
- Fixture: V with a duplicated Vue dependency graph (one override removed) and a slot-bearing UI component.
- Report: "The app runs until I open the Console. Then the UI slots crash even though the component looks normal."
- Root cause: Nuxt and the UI library resolve different Vue instances, so render context and slot helpers aren't shared.
- Why it gets written: preview packages, peer ranges and the package manager can duplicate a runtime with no component change.
- Verification: resolve Vue from both consumers and SSR-render a UI slot through the app's Vue; mount it in the browser. Counting lockfile strings is not enough.
- Solutions:
  - [best] align Vue and renderer peers so consumers share one runtime
  - [acceptable] a justified override or bundler dedupe, checked in SSR and client
  - [over-engineered] rewrite components to avoid slots
  - [masks-symptom] make the area client-only; suppress render errors
- Traps: changes lifecycle hooks at random; pins an incompatible Vue to pass a superficial check.
- Evidence: real, Calories `075a9f1a2f` (`pnpm-workspace.yaml`, `test/vue-runtime.test.ts`).
- Difficulty: 4 · Static-detectable: partly
- From: sol SOL-40

### Security not covered above (SEC)

### SEC1 Mass assignment through a body spread
- Type: both · Class: security · Primitive: Database, h3 · Why: W9, W7
- Fixture: M, `index.patch.ts`: `const body = await readBody(event); db.update(events).set({ ...body, startsAt })`. Variant (Opus): `server/api/account.patch.ts` with `db.update(users).set(await readBody(event))`. 3-8 lines. Decoy DC1 (the validated spread) sits in `index.post.ts`.
- Report: "An event I organized disappeared from my dashboard. Its page now says someone else hosts it." Variant: "Someone's account now shows my email address, marked verified."
- Root cause: the raw body, which can carry `organizerId`, `capacity`, `email` or `emailVerified`, is spread into the UPDATE.
- Why it gets written: `readBody` is the first h3 helper the docs show, and spreading it feels the same as spreading `readValidatedBody`'s output.
- Verification: a PATCH with `{"organizerId":"<other>"}` or `{ emailVerified: true, email: x }` changes nothing; a valid edit still works.
- Solutions:
  - [best] `readValidatedBody(event, eventInputSchema)`, the schema the form already uses (M `shared/schemas/event.ts:13`); Better Auth `updateUser` for account fields
  - [acceptable] pick the fields by hand
  - [over-engineered] an "allowed fields" DSL or a field-level ACL
  - [masks-symptom] `delete body.organizerId` · a denylist misses the next field
  - [wrong] validate types but keep the passthrough
- Traps: flags DC1 too; adds `.strict()` and breaks clients that send extra fields.
- Evidence: real, rubric X8 (1/12); RUBRIC.md cites a real report of a validated body spread into an update.
- Difficulty: 1-2 · Static-detectable: yes
- From: opus NX4 · grok S03

### SEC2 Open redirect through `external: true`
- Type: both · Class: security · Primitive: Nuxt router · Why: W12
- Fixture: M, `app/pages/sign-in.vue:23`: `navigateTo(route.query.redirect as string, { external: true })` and `safeRedirect` (`app/utils/redirect.ts`) deleted. Variant: `window.location.href = redirect`. 2 lines.
- Report: "A user got a phishing mail with a real link to our sign-in page, and after logging in it took them to a fake site."
- Root cause: an untrusted `?redirect=` is followed as an absolute URL.
- Claim (c): **verified** on `nuxt-nightly@5.0.0-2611070044-e3875e8`. `dist/app/composables/router.js:129-132`: an absolute href without `external` throws `NUXT_E2001`; with `external: true` it only refuses script protocols (`NUXT_E2002`). `dist/app/diagnostics/navigation.js:15-18`, dev text: why "Navigating to external URL … is not allowed by default", fix "Use `navigateTo('<url>', { external: true })` to allow external navigation." `dist/app/utils.js:18-25`: `isRootedPath` rejects `//x`, `/\x` and `/<tab>x` after probing two bases, so the plain call is safe (decoy DC2). Production builds use the terse prod diagnostics (`navigation.js:8`); the throw stays.
- Why it gets written: the error's own fix text tells the agent to add `external: true`.
- Verification: `?redirect=//evil.example`, `/\evil.example` and `https://evil.example` land on `/`; `?redirect=/dashboard` still works.
- Solutions:
  - [best] `safeRedirect` (M `app/utils/redirect.ts:5-7`) and a plain `navigateTo`
  - [acceptable] plain `navigateTo` without `external`, catching `NUXT_E2001` and falling back to `/`
  - [wrong] `redirect.startsWith('/')` (passes `//evil.example`); a hostname regex that misses `/\`
- Traps: `startsWith('/')` and done.
- Evidence: real, rubric A6 (1/15).
- Difficulty: 2 · Static-detectable: yes
- From: grok S07 · opus B-only 2

### SEC3 Stored XSS through `v-html`
- Type: both · Class: security · Primitive: Vue · Why: W7
- Fixture: M+ with Markdown descriptions or comments: `v-html="marked(event.description)"`. 2 lines plus a dependency.
- Report: "When I open one event, a popup asks for my password again."
- Root cause: organizer Markdown rendered to HTML without sanitizing.
- Why it gets written: "support Markdown" plus `v-html` is the shortest path.
- Verification: a description with `<img src=x onerror=…>` doesn't run (Playwright dialog count 0); bold still renders; the SSR HTML holds no payload.
- Solutions:
  - [best] a Markdown renderer to Vue nodes with no raw HTML (Comark)
  - [acceptable] DOMPurify on the server before `v-html`; plain text with `whitespace-pre-line` (M's choice, loses Markdown)
  - [masks-symptom] a CSP alone
  - [wrong] regex out `<script>`
- Traps: sanitizes only in the browser, leaving the SSR HTML.
- Evidence: real, Console `f1c1de3`; Drop `1892ddcc`; Doctor `restrictVHtml` (per Grok); rubric X2 (0/15).
- Difficulty: 2 · Static-detectable: yes (Doctor)
- From: grok S08 · opus B-only 3

### SEC4 The cancel link is a state-changing GET
- Type: both · Class: security · Primitive: h3, Email · Why: W12
- Fixture: M+: the reminder links to `/api/events/<slug>/cancel`, a `.get.ts` that deletes the signed-in user's RSVP. 10 lines.
- Report: "People say they got un-RSVP'd from events without clicking anything. They'd visited some forum."
- Root cause: a GET with side effects; `SameSite=Lax` sends cookies on top-level GET navigation.
- Why it gets written: email links are GETs, and "we have SameSite" (DC4) hides that Lax protects only non-GET requests.
- Verification: a cross-site top-level navigation to the link leaves the RSVP; the link opens a page that POSTs.
- Solutions:
  - [best] the GET shows a confirm page; a same-site POST cancels
  - [acceptable] a signed one-time token in the link, no session
  - [over-engineered] CSRF-token middleware on every route
  - [wrong] check `Referer` only
- Traps: in B, flags DC4 instead.
- Evidence: real, Better Auth 1.7.15 cookie `sameSite: "lax"` (`dist/cookies/index.mjs:35`, per Grok); joxi `1c973b6` finding 10.
- Difficulty: 3 · Static-detectable: yes
- From: grok S11

### SEC5 The sort parameter goes through `sql.raw`
- Type: B · Class: security · Primitive: Database · Why: W12
- Fixture: M, `events/index.get.ts`: ``.orderBy(sql.raw(`${sort} ${dir}`))`` from the query string, beside the correct LIKE search (decoy DC3). 2 lines.
- Root cause: identifiers can't be bound, so `sql.raw` takes user text.
- Why it gets written: Drizzle's template binds values, which teaches "Drizzle is safe"; sorting needs an identifier.
- Verification: `?sort=starts_at;--` gives 400 or the default order; a unit test maps an allow-list.
- Solutions:
  - [best] a map from allowed sort names to columns
  - [acceptable] a Zod enum then a switch
  - [wrong] escape quotes
- Traps: flags DC3 as injection.
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: yes
- From: grok S13

### SEC6 Database errors sent to the browser
- Type: B · Class: security · Primitive: h3, Database · Why: W7
- Fixture: M: a `server/utils/handle.ts` wrapper throws `createError({ status: 500, message: e.message, data: { sql: e.query, cause: e } })`. 5 lines.
- Root cause: `message` and `data` reach the client; libSQL errors carry SQL and sometimes a path or URL.
- Why it gets written: it helps debugging, and h3 sends `data` by design.
- Verification: force a constraint error: the body has no SQL, path or stack; the server log has the cause.
- Solutions:
  - [best] log the cause, throw a plain 500 (or let Nitro mask it)
  - [acceptable] map known codes to 4xx with safe text
  - [wrong] strip `stack` only
- Traps: flags M's `console.error` of a provider code as a leak (it's a server log).
- Evidence: synthetic; Doctor nitro `noHttpErrorMasking` (per Grok).
- Difficulty: 2 · Static-detectable: yes
- From: grok S15

### SEC7 Attendee emails in the public event payload
- Type: both · Class: security · Primitive: Database · Why: W7
- Fixture: M, `[slug]/index.get.ts`: returns `attendees: await listAttendees(found.id)` for "who's going" avatars; the helper selects `email`. 2 lines.
- Report: "I'm getting spam addressed to me by name, mentioning a meetup I RSVP'd to."
- Root cause: an organizer helper reused in a public view; `__NUXT_DATA__` carries every field even if the template shows names only.
- Why it gets written: helper reuse, and the page "looks fine".
- Verification: signed out, the event HTML and JSON hold no `@` addresses; avatars still render.
- Solutions:
  - [best] a public helper selecting name only, or a count
  - [acceptable] map to names in the route
  - [masks-symptom] `pick` in the component
- Traps: removes the field from the template only.
- Evidence: real, Drop `0b2c2d7d`; rubric A8 (1/15) and C5.
- Difficulty: 2 · Static-detectable: yes
- From: grok S16

### SEC8 The CSV export runs formulas
- Type: B · Class: security · Primitive: none · Why: W9
- Fixture: M, `attendees.csv.get.ts:6-9`: `rows.map(r => r.join(","))` with no quoting or defusing. 3 lines.
- Root cause: a name like `=HYPERLINK(…)` runs as a formula in Excel or Sheets.
- Why it gets written: CSV looks like plain text.
- Verification: a unit test on `=cmd`, `"a,b"` and `José`: quoted, `'`-prefixed, BOM.
- Solutions:
  - [best] quote every field and prefix `= + - @ \t \r` (M)
  - [acceptable] a CSV library with an escape option
  - [wrong] strip `=`
- Traps: flags decoy DC9 on the clean base.
- Evidence: real, rubric X3.
- Difficulty: 1 · Static-detectable: yes
- From: grok S18 · opus B-only 1

### SEC9 The payment webhook is unsigned
- Type: both · Class: security · Primitive: h3, Database · Why: W9
- Fixture: M+: `server/routes/webhooks/payments.post.ts` marks an RSVP paid when `body.status === "paid"`. Variant: `header === secret`. 6 lines.
- Report: "We have more paid attendees than payments in the provider dashboard."
- Root cause: anyone can POST the webhook (or a timing leak exposes the secret), and a replayed event changes state twice.
- Why it gets written: provider quickstarts parse JSON first; the signature needs the raw body.
- Verification: unsigned or wrongly signed POST gives 401; a replayed signed event changes nothing twice.
- Solutions:
  - [best] HMAC over the raw body (`await event.req.text()`), `timingSafeEqual`, unique provider event id
  - [acceptable] the provider SDK's verify helper
  - [wrong] an IP allow-list only
- Traps: verifies after `readBody` (re-serialized, never matches), then skips the check in dev (MG6).
- Evidence: real, ViteHub `67a98b13a9` (constant-time secret compares). DC14 is the correct JWT form.
- Difficulty: 3 · Static-detectable: yes
- From: grok S20

### Migrations (MG)

### MG1 Move a NuxtHub app to ViteHub
- Type: A · Class: migration · Primitive: Database, KV, Blob, Cache · Why: W8, W4
- Fixture: L. Two variants: NuxtHub 0.7 on Nuxt 3 (`hubDatabase().prepare().bind().all()`, `hubBlob().serve(event, path)`, `hubKV()`, `useDrizzle()`, `.data/hub`; Grok) and NuxtHub 0.10 (`kv`, `blob`, `db` from `@nuxthub/*`, `hub: { db, kv, blob, cache }`, `_hub_migrations`; Opus). A populated seed DB. About 1.5k lines.
- Report: "Move this 3-year-old NuxtHub app to ViteHub and Nuxt 5. Production data must survive."
- Root cause: n/a. Traps from `migrate-from-nuxthub.md` (Opus and Sol read it):
  - KV, Blob and DB calls return `[error, value]`; `if (await kv.get(k))` is always true.
  - `blob.head()` returns `null` instead of throwing 404; `useUpload()` returns an array; multipart `concurrent` becomes `concurrency`.
  - Drizzle relational v1 → v2 (`defineRelations`, object `where`).
  - `TURSO_DATABASE_URL`, `REDIS_URL`, `POSTGRES_URL` aren't read on their own (MG10).
  - KV keys move under `vitehub:kv:<store>`; local data moves from `.data/` to `.vitehub/data/`.
  - The two migration ledgers differ; Wrangler's history table must not be set to `_hub_migrations`; D1 needs a baseline.
- Why it gets written: same method names; "same core methods" hides the changed return shape and the resource identity.
- Verification: M's probe subset passes; event and RSVP counts and row checksums match the seed; a new schema change applies exactly once; KV values read after the move; an empty-database bootstrap works; static: no `@nuxthub/*` imports, no undestructured tuples (VHUB0003).
- Solutions:
  - [best] follow the guide: tuples handled at each call, keep the DB identity with a proven baseline, explicit `connection`, the KV key move
  - [acceptable] the same with relational queries rewritten as `db.select`; export/import into a new DB with integrity checks
  - [over-engineered] a compatibility shim that rethrows tuples; parallel migration frameworks kept forever
  - [masks-symptom] a fresh database and a re-seed
  - [wrong] replay all legacy SQL into the populated DB; set Wrangler's history table to `_hub_migrations`; keep raw D1 `prepare()` through a binding
- Traps: truthy tuples where TypeScript doesn't complain; forgets the env var; grades directory names.
- Evidence: the ViteHub guide; `e4cb99267c` (#4221); nuxt-hub/core#847. The fixture is synthetic.
- Difficulty: 4-5 · Static-detectable: partly
- From: opus MG1 · grok M01 · sol SOL-24

### MG2 Migrated KV calls use the tuple as the value
- Type: both · Class: migration · Primitive: KV · Why: W4, W8
- Fixture: L's settings or J's cursor: the import changed, throwing and direct-value handling kept. 3-8 lines.
- Report: "After moving to ViteHub the saved settings are an array, and storage failures look like successful saves."
- Root cause: ViteHub KV returns `[error, value]`; the old caller uses the tuple as the value and expects failures to throw.
- Why it gets written: familiar method names survive while the failure contract changes.
- Verification: inject success, not-found and a provider failure for `get` and `set`: failures produce the declared HTTP or job failure; no cursor advances on a failed write.
- Solutions:
  - [best] destructure and handle the result at the boundary
  - [acceptable] one small shared unwrap helper for repeated callers
  - [over-engineered] a storage abstraction over every primitive
  - [wrong] return `result[1]` and ignore `result[0]`
- Traps: assumes config errors become tuples too (they throw, pin `packages/kv/src/types.ts:72`); invents atomic locking on Cloudflare KV.
- Evidence: synthetic; pin KV runtime returns results (`runtime/storage.ts`).
- Difficulty: 2 · Static-detectable: yes (Doctor VHUB0003)
- From: sol SOL-27

### MG3 Old h3 v1 server code on Nuxt 5
- Type: A · Class: migration · Primitive: h3 v2, Nitro v3, `nuxt/server` · Why: W8
- Fixture: L's `server/` in h3 v1 style: `event.node.req`, `getHeader`, `readMultipartFormData`, `setResponseHeader`, `send(event, …)`, `sendRedirect`, `createError({ statusCode, statusMessage })`, `nitropack/runtime` imports, and a guard that relied on `readBody` throwing on an empty body. 4-15 files.
- Report: "Upgrade our old Nuxt site to Nuxt 5. The build fails with MISSING_EXPORT. The API should behave the same and still deploy to Workers."
- Root cause: n/a. Traps from the h3 and Nitro migration guides (read by Opus and Sol on GitHub): body utils return empty values instead of throwing; `readBody` no longer uses destr, so prototype poisoning is the app's job; `getRequestURL` no longer trusts `x-forwarded-proto`; header values are strings; `send*` becomes a `return`; multipart becomes `event.req.formData()`; `setResponseHeader` from `nuxt/server` fails the build with `MISSING_EXPORT` (findings-v4).
- Why it gets written: v1 code half-works through compatibility; every Nuxt 3 tutorial shows these names.
- Verification: build on node and cloudflare presets; typecheck; M's route probes (auth, validation, redirect, upload, error); a body-poisoning probe `{"__proto__":{"admin":true}}`. Judge behaviour, not legacy strings.
- Solutions:
  - [best] Web `Request`/`Response` APIs, `nuxt/server` exports, schema-validated bodies (M; `createError({ status, statusText })`)
  - [acceptable] supported compatibility aliases (`defineEventHandler`, `createError`) · valid spelling is not a failure; `h3` imports on Node
  - [over-engineered] a private copy of every h3 v1 helper; a separate H3 app
  - [masks-symptom] `event.runtime.node` everywhere
  - [wrong] downgrade h3 or Nitro; drop validation because `readBody` "no longer throws"; `event.node.res.setHeader` behind `import.meta.server`
- Traps: keeps Node-only `event.node.req`; fails aliases for being aliases.
- Evidence: the guides; M as the target. The fixture is synthetic.
- Difficulty: 3-4 · Static-detectable: yes
- From: opus MG2 · grok M02 · sol SOL-20

### MG4 The redirect runs the mutation under it
- Type: both · Class: migration · Primitive: h3 v2, Auth · Why: W8
- Fixture: L, an organizer handler: `sendRedirect` migrated to `redirect` with no `return`, before an insert. 1-3 lines.
- Report: "I hit the old organizer link while signed out and an event still got created."
- Root cause: the v2 helper returns a response; execution continues unless the handler returns or throws.
- Why it gets written: a mechanical rename of v1's imperative `send*`.
- Verification: anonymous request gets a redirect (or 401/403) with the right `Location` and 0 rows; a signed-in request inserts once.
- Solutions:
  - [best] `return` the redirect, or guard before the mutation
  - [acceptable] throw the right HTTP error for an API route
  - [over-engineered] response-state tracking to suppress later writes
  - [wrong] call `redirect` and continue
- Traps: enforces helper spelling instead of behaviour.
- Evidence: synthetic; h3's migration guide.
- Difficulty: 2 · Static-detectable: yes
- From: sol SOL-16

### MG5 Middleware that protected a prefix now matches one path
- Type: both · Class: migration · Primitive: h3 v2 routing, Auth · Why: W8, W9
- Fixture: L with a standalone h3 adapter: `app.use('/admin', guard)` kept while `/admin/export` is added. 1 line.
- Report: "The admin page asks me to sign in, but its CSV link opens in a private window."
- Root cause: per Sol's read of the h3 guide, v2 path middleware matches the exact path; old code assumes a prefix.
- Why it gets written: the registration syntax survived while matching changed.
- Verification: anonymous `/admin`, `/admin/export` and a nested child all deny; public routes stay public; a signed-in non-organizer still fails.
- Solutions:
  - [best] authorize in the resource handler, or a correct wildcard boundary
  - [acceptable] register guards on each protected route
  - [over-engineered] a reverse proxy for auth
  - [wrong] client route middleware only
- Traps: applies `app.use` semantics to Nuxt file middleware.
- Evidence: synthetic; h3 guide (unverified at h3 2.0.8).
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-17

### MG6 The webhook signature is checked on re-serialized JSON
- Type: both · Class: migration · Primitive: h3 v2 Request · Why: W8
- Fixture: J: a middleware parses JSON, then the handler verifies the signature over `JSON.stringify` of it or re-reads the body. 5-10 lines.
- Report: "The provider says the webhook was delivered, but we reject it or say the body was already read."
- Root cause: a Web Request body is a one-shot stream, and re-serializing changes the signed bytes.
- Why it gets written: old body readers hid stream ownership.
- Verification: sign exact bytes with whitespace and reordered keys: accept once, reject altered bytes and bad signatures, the handler gets the verified object.
- Solutions:
  - [best] read bounded raw bytes once, verify, then parse
  - [acceptable] `clone()` the Request before consumption, when bounded
  - [over-engineered] a webhook relay that normalizes JSON
  - [wrong] verify `JSON.stringify(await req.json())`; skip verification after a read error
- Traps: assumes `readBody` caches in every h3 v2 release.
- Evidence: real report h3js/h3#1241; the plant is synthetic.
- Difficulty: 4 · Static-detectable: yes
- From: sol SOL-18

### MG7 A proxy drops the second Set-Cookie
- Type: B · Class: migration · Primitive: h3 v2 headers, Auth · Why: W8
- Fixture: V: a legacy session proxy copies upstream `Set-Cookie` through one header value or a comma split. 3-7 lines.
- Root cause: several cookies need each `Set-Cookie` kept; commas also appear inside `Expires`.
- Why it gets written: most headers are single strings; cookies are the exception (`getSetCookie`).
- Verification (outside B): two upstream cookies, one with `Expires`, both reach the browser unchanged; sign-out expires both.
- Solutions:
  - [best] return the upstream Response, or append each `headers.getSetCookie()` value
  - [acceptable] a proven Set-Cookie parser
  - [over-engineered] a browser-side cookie protocol
  - [wrong] split on every comma; `headers.set` in a loop
- Traps: tries to read HttpOnly cookies from browser JS.
- Evidence: synthetic; h3 guide.
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-19

### MG8 The TypeScript config no longer loads
- Type: A · Class: migration · Primitive: Nuxt 5 config loading · Why: W8
- Fixture: L: the config imports an extensionless helper with a TypeScript enum. Two files, 5-12 lines.
- Report: "Our Nuxt upgrade fails before it starts building. The config worked for years."
- Root cause: per Sol's read of Nuxt's upgrade guide, Nuxt 5 loads config natively instead of through jiti, so extensionless imports and non-erasable TypeScript fail.
- Why it gets written: app code is bundled, config is not; a working import in app code proves nothing about config.
- Verification: config loads and builds on the pinned Node from a clean install, and the settings survive. Admit only after reproducing on the pin (unverified).
- Solutions:
  - [best] real extensions and erasable TypeScript in the helper
  - [acceptable] the documented optional jiti fallback
  - [over-engineered] a transpile step for two config files
  - [wrong] silence it in tsconfig
- Traps: strips TypeScript from the app; claims Nuxt 5 can't load TS config.
- Evidence: synthetic; Nuxt upgrade guide.
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-21

### MG9 Bump ViteHub across breaking renames
- Type: A · Class: migration · Primitive: Queue, Blob, codemods · Why: W8
- Fixture: M at `1e807fc9`, bumped to a fixed main commit.
- Report: "Bump vitehub to <commit>. CI is red after the bump."
- Root cause: n/a. Breaking changes between the pin and main (checked by Opus and Fable; ancestry verified for each sha):
  - `runQueue` → `sendQueue` (`8785e98e44`, #3714; codemod `queue-workflow-verbs`).
  - The `{ id }` enqueue option is gone (`a7e0b8e916`).
  - Blob serve must choose `public` or `authorize` (`617e7da84f`); M's `/images` sets neither; per-put `access` throws `BLOB_R0045`.
  - `checkRateLimit` returns a tuple (`43128a213e`).
  - Guess: a Drizzle 1.0 rc requirement vs M's `drizzle-orm` 0.45.4.
- Why it gets written: a young library renames weekly; the codemod exists, but agents don't know to look.
- Verification: build and all of M's probes at the target commit; Doctor VHUB0033 `no-removed-apis` clean; serve access explicit.
- Solutions:
  - [best] `npx @vite-hub/codemods`, then fix what it reports (whether it runs on a pkg.pr.new pin is unchecked)
  - [acceptable] hand edits that land the same code
  - [over-engineered] a local wrapper keeping the old names
  - [masks-symptom] pin back; `@ts-expect-error`
  - [wrong] `serve: { public: true }` on a store that also holds private files (with BL1 planted)
- Traps: never finds the codemod; a full lockfile resolution strips pkg.pr.new tarball hashes (vitehub#3958, from project memory).
- Evidence: real, the commits above.
- Difficulty: 3 · Static-detectable: partly
- From: opus MG3 · fable M-01

### MG10 Every deploy wipes all events
- Type: A · Class: migration · Primitive: Database, Env · Why: W8, W2
- Fixture: L or M: `defineDatabase({ schema })` with no `connection`; `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set in the container, as NuxtHub read them.
- Report: "Every time we deploy, all events are gone."
- Root cause: the Definition reads only its `connection`, so data goes to `.vitehub/data/database/sqlite.db` on an ephemeral disk.
- Why it gets written: NuxtHub read the variable on its own; at the pin nothing warns (`e4cb99267c`, #4221, came after it).
- Verification: boot with the variables set: writes land in libSQL (a mock server counts them); on main no `DATABASE_URL_VARIABLE_IGNORED` warning.
- Solutions:
  - [best] `connection: { url, authToken }` from env (M: `env({ source: env.source('DATABASE_URL') })`)
  - [acceptable] a mounted volume for `.vitehub/data`, one instance only
  - [over-engineered] a sync script from SQLite to Turso
  - [masks-symptom] backup and restore on deploy
  - [wrong] rename the variable to `DATABASE_URL` and still pass no `connection`
- Traps: blames the deploy.
- Evidence: real, `e4cb99267c` (#4221).
- Difficulty: 2 · Static-detectable: yes
- From: opus MG4

### MG11 Timers and `waitUntil` to Schedule and Queue
- Type: A · Class: migration · Primitive: Schedule, Queue, Email · Why: W2, W6
- Fixture: L: a Nitro plugin with `setInterval(sendReminders, 15*60e3)`, and RSVP mail sent with `event.waitUntil(email.send(…))`. 10-30 lines.
- Report: "Reminders work while dev is open but stop after we deploy, and confirmations sometimes never arrive. Use ViteHub for this."
- Root cause: a process timer dies on restart and runs in every replica; fire-and-forget mail is lost on a provider error.
- Why it gets written: it was the only option before the primitives existed.
- Verification: `vitehub schedule run event-reminders` queues jobs; a provider error retries; 2 processes give 1 reminder per RSVP; the Node build passes with the process driver (Q17).
- Solutions:
  - [best] `defineSchedule` → one job per RSVP → `defineQueue` handler with the claim (M's shape)
  - [acceptable] Nitro tasks/scheduledTasks with host wiring; a Schedule that sends inline in bounded batches
  - [over-engineered] a Workflow per RSVP
  - [wrong] `schedule: true` on Node (`VITE_HUB_R0137`); a faster interval; an unauthenticated task-trigger route
- Traps: the R0137 error; keeps `waitUntil` "for speed".
- Evidence: real, rubric N1 (`waitUntil` loses mail on a provider error or restart); findings-v5 (R0137).
- Difficulty: 3 · Static-detectable: partly
- From: grok M03 · sol SOL-31

### MG12 Port the reference to Cloudflare
- Type: A · Class: migration · Primitive: Database (D1), Queue, KV, Schedule, Blob · Why: W2
- Fixture: M, unchanged.
- Report: "Deploy this on Cloudflare Workers instead of our VPS."
- Root cause: n/a. Hidden incompatibilities: `idempotencyKey` refused (Q16, claim a), `setIfAbsent` unsupported on Cloudflare KV (claim e), D1's 100 parameters (DB4), the schedule driver, Blob on R2.
- Why it gets written: the host swap compiles; failures show at runtime as logged errors.
- Verification: a Miniflare run of the hidden suite: an RSVP produces a confirmation in the stub; the reminders cron triggers; covers upload and serve.
- Solutions:
  - [best] `preset: 'cloudflare'` with D1, `idempotencyKey` dropped and the handler's claim kept
  - [acceptable] the same plus a redundant D1 dedupe table
  - [wrong] keep `idempotencyKey` because the error is only logged
- Traps: never reads the route's logged `[error]`.
- Evidence: real, pin queue sources (Q16).
- Difficulty: 4 · Static-detectable: partly
- From: grok M04

### MG13 Shallow refs break an old inline editor
- Type: both · Class: migration · Primitive: Nuxt data, Vue reactivity · Why: W8
- Fixture: L's event editor mutates fetched data in place after the move to Nuxt 5. 2-5 lines.
- Report: "Since the upgrade, editing an attendee doesn't update the count until I refresh."
- Root cause: Nuxt's data composables return shallow refs by default (`deep: false`); the old UI expects nested mutations to notify.
- Why it gets written: the value still looks like a Ref of the same object.
- Verification: edit a nested field and add/remove an attendee: totals and text update before any reload; replacing the whole result also works.
- Solutions:
  - [best] a local reactive edit model, or immutable top-level replacement
  - [acceptable] `deep: true` on every consumer of the key
  - [over-engineered] a global store only for nested reactivity
  - [masks-symptom] refetch after every keystroke
- Traps: grades `deep: true` as wrong; mixed depths on one key.
- Evidence: synthetic; Nuxt docs. Confirm at the pin before admitting.
- Difficulty: 3 · Static-detectable: yes
- From: sol SOL-06

### MG14 Hand-written upload checks to Blob helpers
- Type: A · Class: migration · Primitive: Blob · Why: W8
- Fixture: M, `cover.put.ts` with a 40-line validator: size from `content-length`, type from extension and `file.type`, a magic-byte table without WebP.
- Report: "Clean up the cover upload checks; we wrote them before vitehub had helpers for this. Also webp photos get refused."
- Root cause: validation older than `ensureBlob` and `detectContentType`, with a gap.
- Why it gets written: the code predates the helper and nothing says one exists.
- Verification: JPEG, PNG and WebP pass; a PNG declared as JPEG, HTML declared as PNG and a 5 MB photo are refused with a reason; net lines go down.
- Solutions:
  - [best] `ensureBlob(file, { maxSize, types })` plus `detectContentType(bytes)` (M `cover.put.ts:22-24`; pin `ensure.ts:15`, `content-type.ts`)
  - [acceptable] add WebP to the table · fixes the bug, skips the clean-up
  - [over-engineered] a `file-type` dependency plus a sharp decode
  - [wrong] trust `file.type`
- Traps: fixes the WebP line and stops; uses `types: ['image']` (BL2).
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: yes
- From: fable M-03

### MG15 A home-made session service to ViteHub Auth
- Type: A · Class: migration · Primitive: Auth, Database · Why: W8, W9
- Fixture: L with custom password and session routes and a populated DB; 5-8 files, 80-150 lines of old auth.
- Report: "Move sign-in to ViteHub Auth. Existing people must still be able to get in."
- Root cause: a surface swap can leave two session authorities, or drop accounts and password hashes without a policy.
- Why it gets written: a login form working once hides id compatibility, hash compatibility, cookie invalidation and every API's identity source.
- Verification: seeded users keep their ids; the agreed password path (dual-read or reset) works; sign-up, sign-out, expiry and API denial work; an old cookie can't bypass the new authority.
- Solutions:
  - [best] `defineAuth` and its guards, migrate compatible account data, remove the old authority
  - [acceptable] a bounded dual-read migration, or an explicit reset with stated impact
  - [over-engineered] keep both systems indefinitely
  - [wrong] keep accepting any legacy cookie
- Traps: promises to recover plaintext passwords; forces resets despite the continuity requirement.
- Evidence: synthetic; needs Maxi's continuity contract (open question 10).
- Difficulty: 5 · Static-detectable: partly
- From: sol SOL-30

### Change tasks (CH)

Type C: a change on an existing app with no planted bug. "Root cause" becomes "What makes it hard". Fable proposed these; they reuse M's hidden tests and need no plants.

### CH1 Add a waitlist
- Type: C · Class: feature · Primitive: Database, Queue, Email · Why: W5, W6
- Fixture: M, unplanted.
- Report: "When an event is full let people join a waitlist. If someone cancels, the first person waiting gets the seat and an email."
- What makes it hard: the seat rule is one conditional INSERT (`rsvp.post.ts:18-27`); promotion on cancel must stay as atomic.
- Verification: a full event takes a waiter and shows a position; ten parallel cancels and joins promote each waiter once and never exceed capacity (P12 still passes); a promoted guest gets one confirmation through the existing queue; the migration applies on a populated DB.
- Solutions:
  - [best] waitlist rows, promotion in the same statement or transaction as the cancel, mail through `rsvp-confirmation`
  - [acceptable] promotion in a job after the cancel with a conditional insert · a seat is briefly empty, never oversold
  - [over-engineered] a Workflow per event
  - [wrong] check-then-insert promotion; a second mail path that skips the claim
- Traps: builds the UI first and leaves promotion as two queries.
- Evidence: synthetic.
- Difficulty: 4 · Static-detectable: no
- From: fable T-01

### CH2 Add co-organizers
- Type: C · Class: feature · Primitive: Auth, Database · Why: W9
- Fixture: M, unplanted.
- Report: "Let an organizer add co-organizers by email. They can edit the event, see attendees and download the CSV. Only the owner adds or removes them."
- What makes it hard: ownership lives in `findOwnedEvent` (5 handlers) and in two direct comparisons, `server/api/dashboard.get.ts:20` and `server/api/events/[slug]/index.get.ts:35` (per Fable's `rg`).
- Verification: a hidden matrix of every organizer-only route × owner, co-organizer, stranger, anonymous; the dashboard lists co-organized events; score = share of correct cells.
- Solutions:
  - [best] a join table, the helper and both direct comparisons changed, a generated migration
  - [acceptable] a new helper all seven sites call
  - [over-engineered] Better Auth's `organization()` plugin, or a roles layer
  - [wrong] a check copied per route (misses the two comparisons); a global role column
- Traps: changes the helper, sees five routes work, never greps `organizerId`.
- Evidence: synthetic; AU8 plants a bug in the finished feature.
- Difficulty: 3 · Static-detectable: no
- From: fable T-02

### CH3 Delete an event
- Type: C · Class: feature · Primitive: Database, Blob, Queue · Why: W9, W11
- Fixture: M, unplanted (no delete route today).
- Report: "Organizers need a delete button for their events."
- What makes it hard: three stores hold the event: rows cascade (`server/databases/config.ts:67`), the cover is a Blob object, queued jobs name its RSVPs.
- Verification: only the owner can delete; RSVPs gone; the cover gone from Blob; queued jobs finish without retries (`sendRsvpMail` returns on a missing row, `mail.ts:30`); `/events/<slug>` 404s; the method is DELETE or POST.
- Solutions:
  - [best] `DELETE /api/events/[slug]` via `findOwnedEvent`, delete the row, then `blob.del(coverPath)`, a confirm in the UI
  - [acceptable] soft delete with filters at every read · right only if undo was asked for
  - [over-engineered] a Workflow for clean-up
  - [wrong] the row alone; a GET link
- Traps: forgets the cover; doesn't state whether attendees get a mail.
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: no
- From: fable T-03

### CH4 Add a currency
- Type: C · Class: feature · Primitive: none · Why: W7
- Fixture: M, unplanted.
- Report: "Add Japanese yen to the currency picker."
- What makes it hard: the list lives in `shared/utils/currency.ts`, the Zod schema and the `symbols=` parameter in `rates.get.ts`; yen has no minor unit.
- Verification: Playwright: JPY shows a yen price with no decimals, survives reload, and the SSR HTML is already in yen; a `ja-JP` first visit picks JPY; the stub is asked for JPY; a stub without JPY falls back to euros.
- Solutions:
  - [best] add it to the list and the rates schema (about 8 lines)
  - [acceptable] the same, deriving the schema from the list
  - [over-engineered] a currencies table; every currency the provider has
  - [wrong] the picker alone; a hard-coded rate in the browser
- Traps: `toFixed(2)`.
- Evidence: synthetic. The cheapest case and close to the most common request; the time and token baseline.
- Difficulty: 1 · Static-detectable: no
- From: fable T-04

### CH5 Add passkey sign-in
- Type: C · Class: feature · Primitive: Auth, Database · Why: W8, W11
- Fixture: M without passkeys: no plugin, no `passkey` table, no migration `0001`, no account section. M itself is the best answer.
- Report: "Let people sign in with a passkey too, and manage their passkeys on the account page."
- What makes it hard: `authDatabase()` adds only core tables; a plugin's table belongs in the app's Database Definition (M `server/databases/config.ts:17-20,80-82`; pin `docs/content/docs/auth/configure.md:225`, per Fable).
- Verification: rubric P25 with Playwright's virtual authenticator; the migration applies on a populated DB; `rpID` comes from the public site URL.
- Solutions:
  - [best] `passkey()`, the table in `defineDatabase`, a generated migration, `rpID`/`origin` from the site URL (M `server/auth.ts:28-29`)
  - [acceptable] the same with a hand-written migration
  - [over-engineered] WebAuthn by hand
  - [wrong] the plugin without the table; the default `rpID` of `localhost`
- Traps: Better Auth's CLI migration path; both wrong entries pass a quick local try.
- Evidence: synthetic.
- Difficulty: 4 · Static-detectable: partly
- From: fable T-05

### CH6 Refactor the mail code without changing it
- Type: C · Class: refactor · Primitive: Email, Queue · Why: W6
- Fixture: M with `mail.ts` unrolled into two 45-line near-copies, `sendConfirmation` and `sendReminder` (M's `kinds` table is the inverse, `mail.ts:13-16`).
- Report: "mail.ts repeats itself. Clean it up, don't change behaviour."
- What makes it hard: four branches must survive in both paths: the claim, the release on failure, the cancelled RSVP, the started event.
- Verification: 8 hidden tests, one per branch per kind; then duplicated tokens under a threshold, the module ≤ 0.7× its length, queue imports unchanged, the diff inside the module and its two callers.
- Solutions:
  - [best] one function with the kind as data (M)
  - [acceptable] a shared middle with two thin wrappers
  - [over-engineered] a notification framework with classes
  - [wrong] a merge that loses a branch; edits to subjects or templates
- Traps: rewrites more than asked.
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: no
- From: fable T-06

### CH7 Write tests, scored by the plants they catch
- Type: C · Class: tests · Primitive: Database, Queue, Email · Why: W1
- Fixture: M with Vitest set up and one example test.
- Report: "We have no tests for RSVP and the mails. Add some."
- What makes it hard: a test that mocks the database passes on every bug.
- Verification: the tests pass on the base 5/5 within 60 s; then they run against the A plants in those files as mutants (DB1, DB6, Q1, Q2, Q3, the double click, the started event, cancel then rebook); score = mutants killed / mutants.
- Solutions:
  - [best] request-level tests on a real SQLite file, mail stubbed at the provider, one concurrency test
  - [acceptable] handler tests on an in-memory database
  - [over-engineered] a Playwright suite for server rules
  - [masks-symptom] a mocked database; snapshots of bodies
- Traps: sleeps and real timers (the 5-run check exposes them).
- Evidence: synthetic; every A case doubles as a mutant.
- Difficulty: 3 · Static-detectable: no
- From: fable T-07

### CH8 Review a pull request
- Type: B, scoped to a diff · Class: review · Primitive: several · Why: W5, W9
- Fixture: M plus a 350-line branch adding event comments, with 5 plants and 2 decoys; one plant shows only when opening a helper outside the diff. Candidate plants: a delete route without the owner check (AU7), an unchecked `email.send` result (Q1), one author query per comment (DB2), a module-level draft `ref` (SSR1), read-then-insert numbering (DB7).
- Report: "Review this PR before I merge it," with `git diff main...comments`.
- Verification: comments as `{ file, line, severity, body }`, matched as in B, plus one approve or request-changes answer.
- Solutions: not a fix. A best review finds the plants, ranks the owner check first, leaves the decoys alone.
- Traps: style comments that bury the real finding.
- Evidence: Drop `1892ddcc` for the numbering plant; the rest synthetic.
- Difficulty: 3 · Static-detectable: yes
- From: fable T-08

### CH9 "Can a guest get two reminders?"
- Type: C, explain only · Class: not-a-bug · Primitive: Queue, Schedule, Email · Why: W6
- Fixture: M, unplanted.
- Report: "A guest says she got the reminder twice. Can that happen? Don't change anything yet."
- What makes it hard: the honest answer is "almost never, and here is the one way".
- Verification: no file changes; a judge checks three facts: the job claims `reminder_sent_at` in one UPDATE before sending (`mail.ts:27-30`); the schedule's `idempotencyKey` stops overlapping ticks while a job waits or runs (`event-reminders.ts:26-27`); the remaining way is a provider that accepts the mail and loses its answer, the claim goes back, the retry sends again (`mail.ts:62-68`).
- Solutions:
  - [best] the three facts with file and line
  - [acceptable] "no" with the first two
  - [wrong] an invented race; a diff
- Traps: invents a bug to be helpful.
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: no
- From: fable T-09

### CH10 "Emails don't arrive on my machine"
- Type: A, control · Class: not-a-bug · Primitive: Email · Why: W2
- Fixture: M, unplanted.
- Report: "I RSVP on my machine with pnpm dev and never get the confirmation email. Production is fine. Fix it."
- What makes it hard: nothing is broken: in dev, mail stays in ViteHub's outbox unless `remote: true` is set (pin `docs/content/docs/email/get-started.md:51`, per Fable).
- Verification: no change under `server/` or `nuxt.config.ts` beyond comments or docs; the pass-to-pass suite is green; the final message names the outbox (`vitehub email outbox list`) or `remote: true` as an opt-in.
- Solutions:
  - [best] no code change, an explanation, at most a README line
  - [acceptable] an opt-in env flag that sets `remote: true` for one dev session
  - [masks-symptom] print the mail body to the console
  - [wrong] hard-code `remote: true` (dev mails seeded users); replace `email.send` with a direct provider call
- Traps: any diff at all.
- Evidence: synthetic.
- Difficulty: 2 · Static-detectable: no
- From: fable N-04

## 6. Hidden-bug pool

### Plants

Every case marked `both` or `B` with a static signal can be planted; it keeps its case id. Severity is the proposed manifest value; freeze it per fixture before runs. "Doctor" means a Vite Doctor rule names it (report recall with and without these).

| Id | Sev | File area | Static signal | Doctor |
| --- | --- | --- | --- | --- |
| AU7 | critical | `attendees.get.ts`, `attendees.csv.get.ts`, `index.patch.ts`, `cover.delete.ts` | `findEventBySlug` after `requireUser` on an owner-only route | no |
| AU4 | critical | `server/middleware/admin.ts` | guard by exact `pathname ===` | no |
| SEC1 | critical | `index.patch.ts`, `account.patch.ts` | `readBody` spread into `.set()` | no |
| SEC7 | critical | `[slug]/index.get.ts` | organizer helper selecting `email` in a public route | no |
| KV5 | critical | `[slug]/index.get.ts` | cached function whose `getKey` omits the user it reads | no |
| SSR1 | critical | `useAuth.ts`, `server/utils/session.ts` | module-scope `ref` or `let` holding the user | yes |
| EN2 | critical | `nuxt.config.ts`, `app/plugins/rates.ts` | secret under `runtimeConfig.public` or `VITE_` | yes |
| BL1 | critical | `server/api/tickets`, `nuxt.config.ts` blob | private files in the served store; `access: 'private'` | no |
| DB5 | critical | `migrations/*.sql` | `DROP TABLE user` in a generated rebuild | no |
| RT1 | high | `server/realtime/*` | `auth: true` with no `authorize` | no |
| AU5 | high | `server/auth.ts` | `baseURL: requestOrigin`, `trustedProxyHeaders` | no |
| AU6 | high | `server/auth.ts` hooks | email domain decides "server-made" | no |
| AU8 | high | `co-organizers.post.ts` | event id from the body | no |
| AU9 | high | `server/auth.ts` | `disableCSRFCheck: true` | no |
| BL2 | high | `cover.put.ts` | `types: ['image']`, no byte check | no |
| BL4 | high | `cover.put.ts` | `formData()` before any size check | no |
| BL8 | high | `cover.put.ts` | storage key from client input | no |
| SEC2 | high | `sign-in.vue` | `navigateTo(query.redirect, { external: true })` | no |
| SEC3 | high | event description, comments | `v-html` on user Markdown | yes |
| SEC4 | high | `cancel.get.ts` | a GET route that deletes | no |
| SEC5 | high | `events/index.get.ts` | `sql.raw` with query input | no |
| SEC9 | high | `webhooks/payments.post.ts` | no signature check; `===` on a secret | no |
| DB1 | high | `rsvp.post.ts` | count read, then insert | no |
| Q1 | high | `server/utils/mail.ts` | `email.send` error logged, not rethrown | partly (bare form) |
| Q2 | high | `mail.ts` | send before the sent-at claim | no |
| Q16 | high (on a Cloudflare host) | `rsvp.post.ts`, `event-reminders.ts` | `idempotencyKey` with a Cloudflare queue; error only logged | no |
| AU10 | medium | export route | authorization read from a cookie-cached session | no |
| AU12 | medium | `server/auth.ts`, `mail.ts` | reset response awaits the send | no |
| Q3 | medium | `event-reminders.ts` | time window with no sent-at filter | no |
| Q8 | medium | `server/lib/sync.ts` (EL) | module-level `running` promise as a lock | no |
| Q10 | medium | `updateJob` (J) | KV get-spread-set of a status | no |
| Q11 | medium | GET handler (J) | side effect in a GET | no |
| Q13 | medium | `rsvp.post.ts` | awaited send in the request | no |
| Q14 | medium | `sync.ts` (EL) | watch before cursor | no |
| KV1 | medium | `redeem.post.ts` | `kv.get` then `kv.set` on one key | no |
| KV4 | medium | rates client | `x ??= promise` with no reset on rejection | no |
| KV7 | medium | `events/index.get.ts` | module `Map` cache with no bound | no |
| RL1 | medium | `rsvp.post.ts` | unawaited guard; `if (!(await checkRateLimit))`; limiter in handler | yes |
| RL3 | medium | `rsvp.post.ts`, sign-up | `key` from `x-forwarded-for` | no |
| EN1 | medium | `rates.get.ts` | sealed secret interpolated | yes |
| DB4 | medium | `invites.post.ts`, `dashboard.get.ts` (cloudflare) | wide `values()` or `inArray` over ids | no |
| DB6 | medium | `index.patch.ts` | count, then unconditional capacity update | no |
| DB12 | medium | release script | deploy with no migrate step | no |
| SSR3 | medium | `events/index.post.ts` | `new Date(datetimeLocal)` | no |
| SSR4 | medium | session plugin | plain `$fetch` to an internal route in SSR | no |
| SSR6 | medium | event previews | one explicit key for different ids | no |
| SSR8 | medium | search composable | async watcher with no cancel or generation | no |
| SEC6 | medium | `server/utils/handle.ts` | `e.message` and `data` in `createError` | no |
| SEC8 | medium | `attendees.csv.get.ts` | plain `join(",")` | no |
| MG4 | medium | organizer handler (L) | `redirect()` without `return` before a write | no |
| MG5 | medium | h3 adapter (L) | `app.use('/admin', guard)` | no |
| MG6 | medium | webhook (J) | signature over re-serialized JSON | no |
| MG7 | medium | session proxy (V) | one `Set-Cookie` value, comma split | no |
| MG2 | medium | settings, cursor (L, J) | KV result used as the value | yes |
| Q5 | medium | workflow (J) | one step around several effects | no |
| Q6 | medium | `cover.put.ts` | base64 file in a queue payload | no |
| Q7 | medium | `sync.ts` | cursor advances only after `Promise.all` | no |
| BL9 | low | upload route (cloudflare) | `blob.sign` with only a binding | no |
| BL5 | low | `cover.put.ts`, `nuxt.config.ts` | reused path plus `immutable` | no |
| BL6 | low | `EventCard.vue` | `/images/<path>` without `?w=` | no |
| SSR2 | low | `EventStart.vue`, `EventCard.vue` | `toLocaleString`, `Date.now()` in render | yes |
| SSR5 | low | events page | top-level `$fetch` in setup | no |
| SSR7 | low | search page | `useFetch` with reactive query plus a manual `refresh` watcher | no |
| SSR10 | low | lazy widget (V) | `watch` inside a promise callback | no |
| MG13 | low | editor (L) | in-place mutation of `useFetch` data | no |
| DB2 | low | `dashboard.get.ts` | helper query inside a loop | no |
| DB9 | low | `events/index.get.ts` | `lower(column) =` on an indexed column | no |
| DB10 | low | `my-rsvps.get.ts`, schema | `where user_id` with no index on it | no |
| DB13 | low | `events/index.get.ts` | `select()` with no columns in a list | no |
| KV3 | low | `rates.get.ts` | module-variable cache with an `await` between check and set | no |
| KV8 | low | activity feed | `kv.get` → push → `kv.set` of an array | no |

Plants with no fix case (from Opus's B-only list):

| Id | Sev | File area | What it is | Static signal | Evidence |
| --- | --- | --- | --- | --- | --- |
| HB1 | medium | `events/index.get.ts` | LIKE without `ESCAPE`: `%` matches everything | LIKE on user input, no ESCAPE (M has it at `index.get.ts:20-22`) | Drop `f369d248`; rubric B12 failed 6/15 |
| HB2 | low | a bearer-token check | token compared with `!==`, not constant time | string compare on a secret | real in nuxt-evals `site/server/utils/ingest.ts:8` (verified); ViteHub `67a98b13a9` |
| HB3 | medium | a job handler | a claim not released on an early `return` path | claim, then `return` before release | babysitter `39f7a3fd7` |
| HB4 | medium | an enqueue call | queue options inside the payload: `{ payload, delaySeconds }` | VHUB0016 (pin `doctor-rules.md:75`, verified) | Doctor rule |
| HB5 | medium | a Nitro plugin | an enqueue at module scope | VHUB0017 (pin `doctor-rules.md:76`, verified) | Doctor rule |
| HB6 | medium | a GET that writes | with D1 read replicas the next GET reads stale data | write inside a GET | ViteHub `022a06da40` (#2693) |
| HB7 | high | cookie-auth writes | `SameSite=None` and no origin check: CSRF | cookie attributes plus no `sameOriginWrites` | joxi `1c973b6` |
| HB8 | medium | a sync status route | an error message shows a partner's private account names to the household | raw provider error in a shared response | joxi `1fd3769` |
| HB9 | low | a component | `setTimeout` in a `watch` with no `onCleanup` | timer in a watcher | Drop `0664609b` |

### Decoys

Each looks wrong and is correct. A finding on a decoy costs 2 points of precision. File references are M unless noted.

| Id | Code | Looks like | Why it is right | Source |
| --- | --- | --- | --- | --- |
| DC0 | the comment-stripped base, nothing planted | anything | control: findings here are the agent's false-positive floor | Fable B-01 |
| DC1 | `db.update(events).set({ ...input })` with `input` from `readValidatedBody(event, eventInputSchema)` | mass assignment | `z.object` strips unknown keys by default (Zod default, not rechecked) | `index.patch.ts:12-18`; schema at `shared/schemas/event.ts:13` |
| DC2 | `navigateTo(String(route.query.redirect))` without `external` | open redirect | Nuxt throws `NUXT_E2001` for `//x`, `/\x`, `/<tab>x` | claim (c), verified |
| DC3 | `` sql`… LIKE ${containing(q)} ESCAPE '\\'` `` | SQL injection | template values are bound parameters | `events/index.get.ts:20-22` |
| DC4 | JSON POST routes with no CSRF token | CSRF | Better Auth's cookie is `SameSite=Lax`, so a cross-site POST carries no session | better-auth 1.7.15 `dist/cookies/index.mjs:35` (per Grok) |
| DC5 | `routeRules: { "/": { swr: 60 } }` on a page whose header shows the user | cached personal HTML | cache rules strip request cookies and remove `Set-Cookie`, so the cache holds the anonymous page; at worst a flash (low), never a leak | `ocache/dist/index.d.mts:445-449`, verified |
| DC6 | `/api/events/[slug]/seats` without auth | missing auth | seat counts are public by product rule and hold no personal data | `seats.get.ts` |
| DC7 | `findOwnedEvent` answers 404 to a stranger | wrong status | deliberate: it doesn't confirm the event exists | `server/utils/events.ts:13-17` |
| DC8 | the password reset mail sent inline, not queued | should use Queue | a queued job would keep the token on disk | `mail.ts:71-80`, verified |
| DC9 | a CSV cell gets a `'` prefix | data corruption | defuses formula injection | `attendees.csv.get.ts:6-9` |
| DC10 | `requireRateLimit` after validation | ordering bug | a form with mistakes doesn't use the quota | `events/index.post.ts:13`, verified |
| DC11 | `blob.del(found.coverPath)` right after a successful swap | data loss | the old object is orphaned once the swap succeeds | `cover.put.ts:30-39`, verified |
| DC12 | `Cache-Control: immutable` on `/images` | stale covers | each upload gets a random-suffix path | `nuxt.config.ts` blob serve, `cover.put.ts:27`, verified |
| DC13 | `started` computed from `Date.now()` in the API handler | hydration mismatch | the server decides it and the payload carries it | `[slug]/index.get.ts:33`, verified |
| DC14 | the Gmail push route verifies a Google JWT with `jose`, no shared secret | unauthenticated webhook | the JWKS-verified token is the authentication | EL `server/routes/gmail/push.post.ts` (per Grok) |
| DC15 | a fixed-key `useState("locale", …)` in a composable | cross-request leak | `useState` is request-scoped on the server | `app/composables/useCurrency.ts:7`, verified |
| DC16 | two components sharing an async-data key with the same loader | key collision | deliberate shared state | Sol (to add) |
| DC17 | a module-scope Zod schema or constant config | module-scope state | immutable, holds no request data | `shared/schemas/event.ts` |
| DC18 | one `INSERT … SELECT … WHERE count < capacity` | race | a single statement is atomic on SQLite and D1 | `rsvp.post.ts:18-27`, verified |
| DC19 | EL's push debounce with `kv.get` then `kv.set` | race | the D1 lease already serializes syncs; the debounce only trims load | EL `991e3a0` after `2ddf40e` (Grok C08) |
| DC20 | `idempotencyKey` on the enqueue, on a Node host | redundant or broken | supported on Node; Q16 applies only to Cloudflare | `rsvp.post.ts:33`, verified |
| DC21 | the reset mail logs its error and doesn't throw | swallowed error (Q1) | deliberate: the response doesn't wait on it, and the visitor can ask again | `mail.ts:76-80`, verified |

## 7. First 20 Type A cases, and the Type B starter

Merged from the four "build first" lists. "Picks" counts the seats that chose the case (or a case merged into it). Ties are broken toward cases with a verified claim and a cheap counting check, and toward class and primitive coverage.

| # | Case | Picks | Seats | Why |
| --- | --- | --- | --- | --- |
| 1 | DB1 seats go negative | 3 | opus, sol, grok | Maxi's example; the two-process test separates real fixes from mutexes |
| 2 | KV5 cache shows another user's data | 3 | opus, sol, grok | a perf report that tempts a leak; the plant had to be corrected (claim b area) |
| 3 | MG1 NuxtHub to ViteHub | 3 | opus, sol, grok | the migration class Maxi named; needs fixture L first |
| 4 | Q1 failed send logged | 2 | opus, fable | ViteHub's commonest nook; 2-line plant; Doctor-blind form |
| 5 | Q2 retried job resends | 2 | opus, grok | the `idempotencyKey` misconception; many fixes to rank |
| 6 | AU1 per-component session reads | 2 | opus, grok (P07) | the "Vue portal" class (#4054, #4044); a call count |
| 7 | AU3 global session middleware | 2 | opus, grok | pairs with AU1 on the server; mirrors #4001 |
| 8 | DB2 N+1 seat counts | 2 | opus, grok | `Promise.all` is a measurable mask |
| 9 | DB3 waterfall | 2 | opus, fable | the contrast case to DB2; `lazy` is the mask; Drop arm for size |
| 10 | KV1 single-use code twice | 2 | opus, grok | `setIfAbsent` per host (claim e) |
| 11 | KV2 upstream per request | 2 | opus, grok | real 12/15 fail; counting stub |
| 12 | AU7 signed in treated as owner | 2 | opus, grok | difficulty-1 security floor |
| 13 | DB13 list ships every column | 2 | sol, fable | byte budgets; `transform` is a clean mask |
| 14 | BL1 served store publishes private files | 2 | opus, grok | primitive semantics at the pin (per-put `access` no-op) |
| 15 | AU2 Better Auth in the entry chunk | 2 | sol, grok (P07) | bundle check; needs a build per run |
| 16 | Q16 `idempotencyKey` on Cloudflare | 1 | grok | claim (a), a real latent bug in M, 0-line plant |
| 17 | KV6 cached handler ignores query | 1 | grok | claim (b); Nitro 2 habits |
| 18 | BL2 SVG runs script | 1 | grok | claim (d); `types: ['image']` |
| 19 | Q3 reminders twice or never | 1 | opus | the only Schedule case in the set |
| 20 | MG9 ViteHub bump | 1 | opus | real breaking changes and a real codemod; fixture is free |

Grok's P07 was split into AU1 and AU2 and counts for both. Fable's P-09 and D-01 both merged into DB3 and count once.

Next, in order: SEC2 (claim c), BL4 (claim g; fix M first), DB4, RL1, AU5, Q13, Q7 (EL), Q8 (EL), SSR1, SSR2, SSR3, KV3, DB10, DB11, Q15, PF3, PF1. Then the change tasks CH4, CH10, CH2, CH6, CH7 as their own track. J cases (Q4, Q5, Q9-Q12) wait for J.

Seats' 1-pick cases not in the 20: sol SSR1, SSR4, SSR5, SSR6, SSR10, MG2, MG3, MG4, MG5, MG11, MG13, AU10, DB5, Q7, Q13; grok SSR3, Q8, SEC2, AU9, RL3, DB7; fable KV3, KV7, KV8, DB10, DB11, Q15, PF3, PF4, BL6, Q17, CH2, CH4, CH6, CH7, CH10; opus Q3 (in), BL3, BL5, AU5, DB4, RL1, MG9 (in).

### Type B starter fixture

M, comments stripped, at the pin, no new features. 12 plants (Grok's severity), 12 decoys, no count given, web off, Doctor allowed. Run every agent on DC0 too.

| Plants | Severity | File |
| --- | --- | --- |
| AU7 (read form) | critical | `attendees.get.ts` |
| SEC1 | critical | `index.patch.ts` |
| KV5 | critical | `[slug]/index.get.ts` |
| SSR1 (app form) | critical, Doctor | `app/composables/useAuth.ts` |
| EN2 | critical, Doctor | `nuxt.config.ts`, `app/plugins/rates.ts` |
| SEC2 | high | `app/pages/sign-in.vue` |
| BL2 | high | `cover.put.ts` |
| AU5 | high | `server/auth.ts` |
| DB1 | high | `rsvp.post.ts` |
| Q1 | high | `server/utils/mail.ts` (logged form, Doctor-blind) |
| SEC8 | medium | `attendees.csv.get.ts` |
| DB9 | low | `events/index.get.ts` |

Decoys: DC1, DC2 (in `sign-up.vue`, since SEC2 takes `sign-in.vue`), DC3, DC4, DC5, DC6, DC7, DC8, DC10, DC11, DC13, DC15, DC21. Left out because a plant removes them: DC9 (SEC8 rewrites the CSV), DC12 (fine to add; dropped to keep 12+12), DC18 and DC20 (DB1 rewrites `rsvp.post.ts`). Those go into the clean-base and later variants.

Two densities later (Fable): 6 and 18 plants on the same base, to see whether recall falls as plants crowd. Then Grok's "Meetups Hidden" (five plant-hosting features, 30-plant pool, seeded draws of 18) if the starter saturates.

## 8. Open questions for Maxi

1. **Pin.** Wave 1 keeps M at `1e807fc9`. Most fixes the seats cite (blob serve access, schedule once-per-occurrence, `sendQueue`, `vite-hub/test`) landed after it. Keep one pin for wave 1 and rebase in wave 2, or move M to main now and regrade it?
2. **M's native findings.** M buffers the whole upload before the size check (BL4, claim g) and uses `idempotencyKey` that fails on Cloudflare (Q16, claim a). The nuxt-evals `site/` compares the ingest token with `!==` (HB2). Fix M in the base and plant these back per case, or leave M as graded?
3. **Web access.** Recommendation: off for B; on for A with a transcript audit that fails runs fetching the reference, Drop or a fix commit. Agree?
4. **Tools in B.** Recommendation: Doctor and `tsc` allowed, headline recall on Doctor-blind plants. Agree?
5. **"Vue portal".** Best match is #4054 (one shared session store for Vue and Nuxt, "with Capsa's session behavior"); #4044 has the numbers. Is Capsa the portal you meant?
6. **Cloudflare cases** (Q6, Q16, DB4, BL9, MG12): is vite dev with `preset: 'cloudflare'` enough, or a Miniflare check (about 1 GB per run)?
7. **Change tasks.** Are the CH cases in scope now, and do "no change" controls (CH9, CH10) count in the headline or apart?
8. **Report vagueness.** One level (a user's words) or two (plus a log line) to measure what a hint is worth?
9. **Novel fixes.** You label them and they join the corpus as new rows. OK?
10. **Contracts.** Is an occasional duplicate confirmation acceptable when the provider can't dedupe (Q2, Q13)? Must every committed RSVP eventually get mail (outbox or not)? For MG15, must user ids and passwords survive, or is a reset path fine?
11. **B rules.** May B ship a `PRODUCT.md` with the intended access rules (without it DC6, DC7 and SEC7 are opinions)? Real unplanted findings: neutral, as recommended, or a bonus?
12. **Tooling.** A runs with no skills. Later, the same cases with setups B and C to measure what MCP and skills add to fixes?

## 9. Cut cases

- **sol SOL-15** (source filter cache keys collide): only tests a ViteHub bug in `packages/source` (`79f6b65795`, before the pin); there is no app-code form.
- **sol SOL-22** (standalone Nitro loses routes and tasks): outside the Nuxt fixtures; Nuxt supplies the scanning config, and AGENTS.md scopes the evals to Nuxt 5.
- **sol SOL-39** (workspace read on an old revision): the real fix moved an internal reset helper in Console; there is no stable app-level fixture or public API to grade at a pin, as Sol itself noted.
- **grok P09** (30-day cache evicted by `setTimeout` overflow): refuted at the pin. ocache 0.3.1 chains timers past 2^31−1 ms (`ocache/dist/index.mjs:302-308`, verified), and Nitro 3 uses unstorage 2 beta, not the 1.x driver Drop patched.
- **opus B-only 6** (`%2e%2e` traversal through a decoded blob key): unverified on the pin and main, and it would test ViteHub's key decoding rather than app code.
- **fable B-01** as a case: kept as decoy control DC0, not a case.

Merged with a changed plant (not cut): opus AU3 became KV5, because `defineCachedEventHandler` doesn't exist in Nitro 3 and a cookie-stripped cached handler gives 401, not a leak.
