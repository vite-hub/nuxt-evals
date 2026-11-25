# Ecosystem bugs and migration corpus

Research checked on 2026-11-14. This is a proposal, not an executed benchmark. Fixture locations, plant sizes, checks and solution rankings below are proposed. "Why it gets written" is a causal hypothesis grounded in the cited contract, not a measured claim about prevalence. Historical reports are evidence of a failure class, not proof that today's release still has it. No installs, builds, tests, servers, account mutations or upstream posts were performed.

## Grading and fixtures

For A, use 100 points: working outcome 25, correct root cause 15, solution quality/class 15, minimality 10, appropriate primitive use 10, regression safety 10, verification evidence 5, time 4, tokens 3, dollar cost 3. A broken build or failed central behavior caps the total at 25; data loss or an authorization regression fails the case. Judge minimality by necessary concepts and maintenance burden, not lines or file layout. A justified direct SQL statement can beat several abstractions. Measure efficiency against the same case and model settings, include tool latency, and report cached tokens and judge cost separately. Publish quality and efficiency separately as well.

For B: severity-weighted recall 40, precision 30, severity ordering 15, causal explanation 15. Freeze severity and independent bug identities before runs. One finding cannot earn credit for several bugs without distinct causal claims. Precision counts actionable unsupported claims as false positives; hypothetical warnings earn nothing. Require a location, trigger, consequence and reasoning. Deduplicate repeated reports. Score recall on planted bugs, but investigate valid unplanted findings separately and update the frozen benchmark version for every setup.

Hidden checks establish behavior; a blinded rubric judge matches mechanisms to solution families and assesses tradeoffs. Never match by patch text, helper name or directory. Test at least two distinct correct solutions and tempting wrongs. Novel correct solutions enter manual adjudication, not automatic rejection. B agents only read supplied repository files; reference verification runs outside their sandbox. Include clean repos and plausible safe patterns.

Reuse Meetups for most cases, add a frozen legacy Meetups variant, a small mail-sync fixture, and a small document/session viewer. Keep one root cause per A run; use independently composable 3-5-bug packs for B. Avoid one huge app initially. Start one baseline run, inspect it, then scale, as required by [P1](/home/maxi/vitehub/nuxt-evals/research/plan-v2.md).

## Cases

### SOL-01 Logged in until a hard refresh

- Type: both · Class: bug · Primitive(s): Nuxt SSR fetching, Auth
- Fixture: Meetups account page or session composable; replace request-aware internal fetching with plain `$fetch`, 1-3 lines.
- Report given to the agent: "I'm signed in, but opening my bookings in a new tab says I'm logged out. Clicking around fixes it."
- Root cause: The server's internal fetch does not carry the visitor's session cookie. Client navigation does, so the two paths disagree.
- Why it gets written: `$fetch` looks universal, while forwarding request identity is a separate concern in SSR [N3](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/12.data-fetching.md).
- Verification: Request SSR HTML as Alice and Bob and compare identity; anonymous API stays 401. Initial hydration must not add a compensating session request. Assert no cookies reach a mocked external rates host.
- Solutions:
  - [best] Use relative `useFetch`, or capture `useRequestFetch` in setup and use it inside `useAsyncData` · preserves identity and SSR payload.
  - [acceptable] Forward only the necessary cookie to the trusted internal endpoint · explicit and bounded.
  - [over-engineered] Add an auth proxy service · duplicates framework behavior.
  - [masks-symptom] Disable SSR for the account area · hides the missing identity propagation.
- Agent traps: Forward every header to external URLs; interpret an SSR 401 as an expired session; remove the API guard.
- Evidence: Real report [nuxt/nuxt#24813](https://github.com/nuxt/nuxt/issues/24813), read in full; contract [N3](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/12.data-fetching.md). Synthetic transplant. Nuxt 5 island forwarding also had a separate real regression [#36179](https://github.com/nuxt/nuxt/issues/36179), so isolate ordinary fetching from island internals.
- Difficulty: 2 · Static-detectable: yes

### SOL-02 The first page fetches everything twice

- Type: both · Class: perf · Primitive(s): Nuxt payload, SSR fetching
- Fixture: Meetups event list; use top-level `$fetch` directly in setup, 2-4 lines.
- Report given to the agent: "Opening the events page makes two API calls and the list flashes."
- Root cause: Setup runs on server and client without transferring the fetched result through Nuxt's data payload.
- Why it gets written: A normal awaited fetch returns useful data during SSR, making the missing hydration handoff easy to miss [N3](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/12.data-fetching.md).
- Verification: Count list-handler invocations for one SSR load plus hydration: one logical fetch and zero browser list calls before interaction; changing a filter still fetches once.
- Solutions:
  - [best] Use `useFetch` or `useAsyncData` with a truthy serializable result · transfers initial data.
  - [acceptable] Implement explicit request-scoped state and payload transfer · correct but more ownership.
  - [over-engineered] Add a browser cache library and service worker · unnecessary for the handoff.
  - [wrong] Use `onMounted` as the sole loader · loses server-rendered list content.
- Agent traps: Treat HTTP connection reuse as dedupe; wrap side-effecting mutations in the initial data handler.
- Evidence: Synthetic; Nuxt explicitly documents double setup fetching and payload transfer [N3](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/12.data-fetching.md). A real lazy-hydration variant is [nuxt/nuxt#32443](https://github.com/nuxt/nuxt/issues/32443); do not assume that framework report reproduces on the fixture pin.
- Difficulty: 1 · Static-detectable: yes

### SOL-03 Two event cards share the wrong details

- Type: both · Class: bug · Primitive(s): useAsyncData, Nuxt keyed state
- Fixture: Meetups side-by-side event previews; force the same explicit key for different IDs, 1-2 lines.
- Report given to the agent: "Sometimes the second event shows the first one's attendees."
- Root cause: Calls with the same async-data key share refs even though their handlers or result shapes represent different data.
- Why it gets written: A key can look like an arbitrary label, but it defines shared state and requires consistent options [N1](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/4.api/2.composables/use-async-data.md).
- Verification: Render two IDs together, navigate between IDs, then change city/currency. Each view must show its own expected data without a full reload.
- Solutions:
  - [best] Derive stable keys from all inputs defining the resource; reuse one consistent loader for intentionally shared data · models identity.
  - [acceptable] Remove an unnecessary explicit key when the pinned version generates suitable distinct keys · verify reactive navigation too.
  - [over-engineered] Put every API response into a global entity store · excessive for two previews.
  - [wrong] Generate a random key on every render · defeats SSR reuse and caching.
- Agent traps: Change only the handler URL; fix one route while leaving layout consumers on the colliding key.
- Evidence: Synthetic; shared-state and option-consistency contract [N1](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/4.api/2.composables/use-async-data.md). Auto-key behavior is version-sensitive, see the source ledger.
- Difficulty: 2 · Static-detectable: yes

### SOL-04 Every filter change sends two requests

- Type: both · Class: perf · Primitive(s): useFetch, Vue reactivity
- Fixture: Meetups search; retain reactive query options and add a delayed manual watcher calling `refresh`, 3-6 lines.
- Report given to the agent: "Typing a city hits our API twice. The loading spinner keeps restarting."
- Root cause: Automatic option watching and a manual refresh both own the same update. Staggering the callbacks makes the duplicate deterministic.
- Why it gets written: Developers often carry a Vue watcher into `useFetch` without accounting for its automatic refetching [N2](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/4.api/2.composables/use-fetch.md).
- Verification: Record requests for a fixed filter sequence and Back/Forward navigation; one final query per committed interaction. Include empty-query and page-reset transitions.
- Solutions:
  - [best] Keep one reactive request definition and remove redundant refresh ownership · one trigger path.
  - [acceptable] Set `watch: false` and explicitly own debouncing and refresh · useful when the interaction requires it.
  - [over-engineered] Add an application-wide request scheduler · too broad.
  - [masks-symptom] Increase debounce until duplicates appear rare · both trigger paths remain.
- Agent traps: Claim `dedupe: 'defer'` fixes staggered sequential duplicates; break URL synchronization while reducing calls.
- Evidence: Synthetic; reactive options and `watch: false` [N2](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/4.api/2.composables/use-fetch.md).
- Difficulty: 2 · Static-detectable: yes

### SOL-05 Slow search wins over a newer query

- Type: both · Class: bug · Primitive(s): useAsyncData, AbortSignal
- Fixture: Meetups custom search composable; remove cancellation/generation protection from an async watcher, 3-8 lines.
- Report given to the agent: "I search for Paris, change it to London, and Paris comes back after London loads."
- Root cause: An older response can commit after a newer one. A cancellation setting alone does not prove that the underlying request observes its signal.
- Why it gets written: Dedupe, transport abort and deciding which result may update the UI are related but distinct contracts [N1, U1].
- Verification: Hold Paris behind a barrier, resolve London, then release Paris. UI and URL must remain London; record cancellation separately. No timing race in the test itself.
- Solutions:
  - [best] Use the pinned Nuxt data API with its signal passed to `$fetch` and demonstrate latest-result behavior · framework owns the request lifecycle.
  - [acceptable] Use an AbortController plus a monotonically increasing request generation · covers non-abortable loaders too.
  - [over-engineered] Add a server-side search job queue · solves the wrong lifecycle.
  - [wrong] Use `dedupe: 'defer'` and assume the last query ran · may retain or defer stale work.
- Agent traps: Test only final state after waiting several seconds; assume an open framework report is already fixed.
- Evidence: Synthetic app-level race; real report [nuxt/nuxt#36893](https://github.com/nuxt/nuxt/issues/36893) describes watched async-data cancellation trouble on 4.6.3/main. This requires pin-specific calibration, not an assertion that every Nuxt 5 build is broken. [N1, U1].
- Difficulty: 4 · Static-detectable: partly

### SOL-06 An old inline editor stopped reacting

- Type: both · Class: migration · Primitive(s): useFetch, shallow refs, Vue
- Fixture: Legacy Meetups event editor; preserve nested in-place mutation of fetched data after upgrading to Nuxt 5, 2-5 lines.
- Report given to the agent: "Since the upgrade, editing an attendee doesn't update the count until I refresh."
- Root cause: The pinned data API uses shallow refs by default; the old UI expects nested mutations to notify consumers.
- Why it gets written: The returned value still looks like a `Ref` of the same object, while the reactivity depth changed [N1, N2].
- Verification: Edit a nested field and add/remove an attendee; derived totals and rendered text update before any network reload. Replacing the entire result must also work.
- Solutions:
  - [best] Use an explicit local reactive edit model or immutable top-level result replacement · makes mutable ownership clear.
  - [acceptable] Use `deep: true` consistently across consumers of the same key · valid when this data is intentionally mutable.
  - [over-engineered] Move the editor into a global store solely to restore nested reactivity · unnecessary.
  - [masks-symptom] Refetch after every keystroke · hides local reactivity failure and wastes requests.
- Agent traps: Grade `deep: true` as inherently wrong; use inconsistent depths with a shared key.
- Evidence: Synthetic migration; current docs specify `deep: false` [N1, N2]. Confirm the frozen target behaves this way before admitting the case.
- Difficulty: 3 · Static-detectable: yes

### SOL-07 The list ships the entire attendee database

- Type: both · Class: perf · Primitive(s): Database, SSR payload
- Fixture: Meetups list endpoint returns full event objects with attendee/history arrays; 5-10 lines.
- Report given to the agent: "Events load slowly on my phone even though the cards barely show anything."
- Root cause: The server queries and serializes fields the list never uses, possibly including private attendee fields.
- Why it gets written: Reusing a full detail query is convenient, and component templates hide the cost of data already placed in the SSR payload [N1, N3].
- Verification: Seed 2,000 large events; assert a declared uncompressed payload budget, bounded list rows and absence of attendee emails/history. Detail pages and pagination still work.
- Solutions:
  - [best] Project required columns and paginate on the server · reduces query, serialization and transfer work.
  - [acceptable] Return a dedicated safe list DTO after fetching · reduces exposure and payload but retains excess DB work.
  - [acceptable] Use `pick`/`transform` where only payload size is at issue · cannot protect a public endpoint that already exposes private fields.
  - [masks-symptom] Enable gzip and leave the full objects · does not remove serialization or disclosure.
- Agent traps: Measure compressed network bytes but ignore HTML payload; call client-side `pick` an authorization boundary.
- Evidence: Synthetic; payload/pick contract [N1, N3] and the original Meetups perf design [P1](/home/maxi/vitehub/nuxt-evals/research/plan-v2.md). Database projection is available through the verified Drizzle API [V1].
- Difficulty: 2 · Static-detectable: yes

### SOL-08 Another visitor's bookings in module state

- Type: B (hidden) · Class: security · Primitive(s): Nuxt SSR state, Auth
- Fixture: Meetups `useAuth` or bookings composable; lift a user-bearing `ref` to module scope, 2-4 lines.
- Root cause: A process-wide reactive object holds request-specific identity or bookings and is reused by concurrent SSR requests.
- Why it gets written: Module scope is a normal way to share Vue state in a client-only app; universal rendering changes the lifetime [N4](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/13.state-management.md).
- Verification: Outside the scan run, overlap Alice/Bob SSR requests behind barriers and assert each HTML/payload contains only its identity. Include two sequential requests on one warm worker.
- Solutions:
  - [best] Create request-scoped Nuxt state with `useState` inside a composable/setup · supports sharing within one SSR request.
  - [acceptable] Pass request-local data explicitly through the component tree · clear ownership.
  - [over-engineered] Create a global map indexed by cookies with eviction · introduces another identity cache.
  - [wrong] Clear the module ref at request start/end · overlapping requests still interfere.
- Agent traps: Flag every module singleton, including immutable schemas and public configuration; claim a fixed `useState` key alone causes a cross-request leak.
- Evidence: Synthetic; Nuxt explicitly warns about module-level refs [N4](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/13.state-management.md). Existing request-scoped counterexample: `tasks/meetups/reference/app/composables/useAuth.ts:16`.
- Difficulty: 3 · Static-detectable: yes

### SOL-09 Event times disagree during hydration

- Type: both · Class: bug · Primitive(s): Nuxt SSR, Vue, Intl
- Fixture: Meetups `EventStart` component; format local time independently in SSR and client, 3-6 lines.
- Report given to the agent: "The event date jumps when the page opens, and sometimes it shows the wrong day."
- Root cause: The server and browser derive different text from their time zones or independent current times.
- Why it gets written: `toLocaleString` and `Date.now` look deterministic in one development browser; SSR and the browser are separate environments [P1](/home/maxi/vitehub/nuxt-evals/research/plan-v2.md).
- Verification: Freeze time near midnight and a DST transition; render server UTC and browser America/Los_Angeles. No hydration warning; final visitor-local date remains correct. Also test a non-hour offset.
- Solutions:
  - [best] Render a deterministic initial time/zone and progressively localize with explicit visitor context · preserves useful SSR content.
  - [acceptable] Client-render only the inherently local fragment with a stable SSR fallback · bounded scope.
  - [over-engineered] Add an external time-conversion service · platform APIs suffice.
  - [masks-symptom] Suppress hydration warnings or wrap the entire page in ClientOnly · leaves the cause or loses useful SSR.
- Agent traps: Fix the server time zone globally and assume every visitor shares it; test only daylight hours.
- Evidence: Synthetic; independently specified in `research/plan-v2.md`, F3 and runtime probes [P1](/home/maxi/vitehub/nuxt-evals/research/plan-v2.md). No matching historical fix was established.
- Difficulty: 2 · Static-detectable: partly

### SOL-10 A watcher survives the component that created it

- Type: B (hidden) · Class: perf · Primitive(s): Vue effect scopes, Auth client
- Fixture: Small viewer's lazy session/widget loader; create a watcher in a promise callback without lifecycle ownership, 5-10 lines.
- Root cause: The watcher is created outside the component's synchronous setup scope and continues work after unmount, or is installed after the component has already disappeared.
- Why it gets written: Lazy imports move hook setup into a promise continuation; Vue's automatic watcher disposal depends on scope ownership [U1](https://github.com/vuejs/docs/blob/40aa88af0094f7bab4aaf786e55c748a6a251d88/src/guide/essentials/watchers.md).
- Verification: Outside B, mount/unmount 50 times, including unmount-before-import-resolves. Mutate the observed session source and assert zero callbacks for dead instances and one for the live instance.
- Solutions:
  - [best] Create the watcher synchronously and gate its work on readiness · retains automatic disposal.
  - [acceptable] Capture the owner scope, check it remains active and register the watcher/cleanup there · fits a lazy adapter.
  - [over-engineered] Maintain a global widget registry and sweeping timer · duplicates lifecycle management.
  - [wrong] Add a DOM-existence check inside each leaked callback · watcher remains live.
- Agent traps: Flag all top-level `await` in script setup; the issue is arbitrary async callbacks losing ownership, not every compiler-supported await.
- Evidence: Real constraint [U1](https://github.com/vuejs/docs/blob/40aa88af0094f7bab4aaf786e55c748a6a251d88/src/guide/essentials/watchers.md); real lazy-auth scope/context preservation in Drop commit `f949cdb7645b6b0af48c6cd62ab34206971b3abf`, `patches/@vite-hub__auth@0.0.4.patch`, read with `git show`. Synthetic isolated plant.
- Difficulty: 4 · Static-detectable: yes

### SOL-11 Public readers pay for the auth client

- Type: A (fix) · Class: perf · Primitive(s): Auth, Vue code splitting
- Fixture: Small document viewer based on Drop; eagerly import Better Auth through the public shell, 1 import and one shared adapter.
- Report given to the agent: "Even a public document downloads all the sign-in code before I touch Sign in."
- Root cause: The shared shell synchronously depends on the auth client, so its code enters the initial client dependency graph.
- Why it gets written: A singleton `createAuthClient` looks cheap at the call site; its static imports still contribute to the public route bundle [V2].
- Verification: Inspect the production route dependency graph and browser requests; no Better Auth client code before a session/sign-in feature is needed. Sign-in, sign-out and early unmount must still work.
- Solutions:
  - [best] Use the lazy client provided by the selected ViteHub build if present · centralizes client loading and hook lifetime.
  - [acceptable] Dynamically load the existing auth adapter at the feature boundary and preserve loading/error behavior · works without a newer provider API.
  - [over-engineered] Rewrite authentication to shrink the bundle · excessive scope.
  - [masks-symptom] Preload the auth chunk or hide the spinner · does not remove the public-route dependency.
- Agent traps: Invent `loadAuthClient` on an older pin; measure only the entry chunk and miss eager dependencies.
- Evidence: Real Drop commit `f949cdb7645b6b0af48c6cd62ab34206971b3abf`, read patch and app diff. It references ViteHub #2692. The inspected ViteHub checkout still has eager `packages/auth/src/vue.ts:1`, so this case must use an explicit version manifest [V2].
- Difficulty: 3 · Static-detectable: partly

### SOL-12 Every panel repeats the session query

- Type: both · Class: perf · Primitive(s): Auth, Nuxt SSR state
- Fixture: Meetups header, account summary and server helper; duplicate independent session reads, 6-12 lines.
- Report given to the agent: "A page with three account widgets is much slower than one with a single widget."
- Root cause: Consumers independently repeat session resolution instead of sharing one request-scoped result. Determine whether the pinned provider already deduplicates before planting.
- Why it gets written: Calling a convenient helper several times hides the I/O inside it; browser hook caching and server request caching have different lifetimes [V2, F1].
- Verification: Instrument provider/session-store reads, not helper call count. Three widgets on one SSR request perform one lookup; a second user gets a distinct lookup. Sign-out and role changes remain effective.
- Solutions:
  - [best] Share the existing request-scoped session result/promise and Nuxt payload state where appropriate · removes repeated I/O without widening lifetime.
  - [acceptable] Resolve once at the common owner and pass the result · simple and explicit.
  - [over-engineered] Add Redis for session-query dedupe · unnecessary across independent requests.
  - [wrong] Cache one session promise in a module variable · leaks identity between visitors.
- Agent traps: Enable a long cookie cache without considering revocation; optimize provider calls already memoized by the selected version.
- Evidence: Synthetic, not a discovered live-app bug. Reference session helper and startup sharing are checked at `tasks/meetups/reference/server/utils/session.ts:5`, `app/plugins/session.ts:2`, `app/composables/useAuth.ts:16` [F1](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/api/events/[slug]/rsvp.post.ts).
- Difficulty: 3 · Static-detectable: partly

### SOL-13 A removed privilege stays in the cookie cache

- Type: both · Class: security · Primitive(s): Better Auth session cache, Auth
- Fixture: Meetups organizer-only export; authorization reads a cached custom session privilege after an administrator changes it, 5-12 lines.
- Report given to the agent: "I removed someone's organizer access, but they can still download attendees for a while."
- Root cause: A signed cached session snapshot remains valid cryptographically while its policy fields are stale relative to the database.
- Why it gets written: Authenticity and freshness are different. Cookie-cache performance options make a valid signature look like a current authorization decision [BA1](https://github.com/better-auth/better-auth/issues/11501).
- Verification: Get a cached session, revoke organizer access, immediately request the export with the original cookies. Require 403 while ordinary non-sensitive reads still meet the chosen cache policy.
- Solutions:
  - [best] Read current authorization for sensitive operations, bypassing cookie cache where supported · matches the required revocation semantics.
  - [acceptable] Disable cookie caching for the app when immediate revocation is required everywhere · trades DB reads for freshness.
  - [over-engineered] Build a custom session protocol and invalidation bus · not needed for this fixture.
  - [masks-symptom] Shorten cache TTL but still promise immediate revocation · retains the forbidden window.
- Agent traps: Use the issue's proposed `refreshSessionCookieCache` helper as an existing API; trust client session state in the export handler.
- Evidence: Real report [better-auth/better-auth#11501](https://github.com/better-auth/better-auth/issues/11501), read in full, concerns 1.7.6 session-row updates. The privilege fixture is a synthetic adaptation; verify behavior on the reference's 1.7.15 pin. Verified bypass input [V2].
- Difficulty: 4 · Static-detectable: partly

### SOL-14 A cached personal page shows the previous visitor

- Type: both · Class: security · Primitive(s): Nitro cache, route rules, Auth
- Fixture: Meetups personal bookings; apply a broad cache rule or cache a closure over request-specific output under a shared key, 1-6 lines.
- Report given to the agent: "My friend opened My bookings and saw my name. Reloading sometimes changes it."
- Root cause: The cache boundary includes personalized output without a user-specific identity boundary or bypass.
- Why it gets written: Route-wide SWR is attractive for slow pages, while session reading may be hidden inside a layout or composable [T2](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/7.cache.md).
- Verification: Alternate Alice, Bob and anonymous requests through the same cache; inspect both HTML and payload. Public event data should remain cacheable; no private response may enter a shared entry.
- Solutions:
  - [best] Keep personal responses private and cache only public expensive subcomputations · narrow safe cache scope.
  - [acceptable] Use a correctly scoped per-user cache with an explicit freshness/invalidation policy · warranted only if needed.
  - [over-engineered] Create a separate deployment for every user · disproportionate.
  - [wrong] Add a user cookie to the browser without changing the server cache contract · key/output mismatch remains.
- Agent traps: Assert all cached handlers expose cookies. Current Nitro narrows request inputs and strips cookies unless allowed; pin and prove the actual leak instead of planting a non-reproducing folklore example [T2](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/7.cache.md).
- Evidence: Synthetic; current cache input narrowing, bypass and cookie rules [T2](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/7.cache.md). Use a deliberately unsafe shared cached function or a verified vulnerable rule on the pinned build.
- Difficulty: 4 · Static-detectable: partly

### SOL-15 Different source filters collide in one cache key

- Type: B (hidden) · Class: nook · Primitive(s): Source, Workspace, cache
- Fixture: Small document viewer; restore ambiguous delimiter encoding for source-filter arrays, about 8 lines.
- Root cause: Joining values with commas/colons maps different structured inputs to the same cache key. Distinct file filters can reuse the wrong source result.
- Why it gets written: Human-readable concatenation appears sufficient until user-supplied values themselves contain separators [R1](https://github.com/vite-hub/vitehub/commit/79f6b657955583ebfad52abc59a2f12129474b5b).
- Verification: Outside B, compare `["a,b", "c"]` with `["a", "b,c"]` using identical repo/ref/root. Then vary auth scope and key independently; no unintended cache reuse.
- Solutions:
  - [best] Serialize the structured tuple without losing array boundaries, including authorization scope · unambiguous identity.
  - [acceptable] Hash a canonical structured serialization · compact keys with equivalent separation.
  - [over-engineered] Replace the cache backend · collisions originate before storage.
  - [wrong] Escape only colons while still flattening filter arrays · leaves collisions.
- Agent traps: Describe the real fix as an authentication bypass. The checked regression proves filter collisions; a private-data disclosure requires a separate demonstrated auth-scope failure.
- Evidence: Real ViteHub fix `79f6b657955583ebfad52abc59a2f12129474b5b`, `packages/source/src/sources/github/cache.ts`, with a concrete regression test [R1](https://github.com/vite-hub/vitehub/commit/79f6b657955583ebfad52abc59a2f12129474b5b).
- Difficulty: 3 · Static-detectable: yes

### SOL-16 A redirect runs the mutation underneath it

- Type: both · Class: migration · Primitive(s): h3 v2, Auth
- Fixture: Legacy Meetups organizer handler; migrate `sendRedirect` to `redirect` but omit `return`, 1-3 lines.
- Report given to the agent: "I hit the old organizer link while signed out and an event still got created."
- Root cause: The new response-producing helper returns a value; execution continues unless the handler returns or throws before the side effect.
- Why it gets written: h3 v1's imperative `send*` patterns encourage mechanical renaming without revisiting control flow [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md).
- Verification: Anonymous request yields a redirect or 401/403 and zero inserted rows; authenticated request inserts once. Also verify the Location header and status.
- Solutions:
  - [best] Return the redirect response immediately or put the mutation behind the existing auth guard · makes continuation impossible.
  - [acceptable] Throw the appropriate HTTP error for an API endpoint · clear failure semantics.
  - [over-engineered] Add global response-state tracking to suppress later writes · duplicates control flow.
  - [wrong] Call `redirect` and then continue to the database operation · response construction does not authorize code.
- Agent traps: Enforce helper spelling instead of behavior; blanket-rename Nuxt's supported compatibility exports [N5](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/20.upgrade.md).
- Evidence: Synthetic migration, explicit return requirement in h3's migration guide [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md). `withAuth`/`withAuthorization` exist in inspected ViteHub [V2].
- Difficulty: 2 · Static-detectable: yes

### SOL-17 The auth middleware protects only the prefix

- Type: both · Class: security · Primitive(s): h3 v2 routing, Auth
- Fixture: Standalone h3 adapter inside a small Nuxt fixture; keep `app.use('/admin', guard)` while adding `/admin/export`, 1 line plus existing route.
- Report given to the agent: "The admin page asks me to sign in, but its CSV link opens in a private window."
- Root cause: h3 v2 path middleware matches the exact path; the old code assumes a prefix match for descendants.
- Why it gets written: The same registration syntax survives while matching semantics changed [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md).
- Verification: Anonymous `/admin`, `/admin/export` and a nested child all deny access; public routes remain public. A signed-in non-organizer still fails authorization.
- Solutions:
  - [best] Apply auth/authorization at the resource handler or correct wildcard middleware boundary · protects every intended route.
  - [acceptable] Register guards for the finite set of protected routes · explicit and testable.
  - [over-engineered] Add a second reverse proxy only for auth · unnecessary.
  - [wrong] Protect only the page using client route middleware · direct API calls remain open.
- Agent traps: Apply h3 `app.use` semantics to Nuxt file middleware without checking how it is registered; confuse authentication with organizer authorization.
- Evidence: Synthetic transplant of a documented breaking change, [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md), H3/router section.
- Difficulty: 3 · Static-detectable: yes

### SOL-18 Webhook verification consumes or changes the body

- Type: both · Class: migration · Primitive(s): h3 v2 Request, Channels/webhook ingress
- Fixture: Mail-sync webhook; parse JSON in middleware, then verify or read the original body in the handler, 5-10 lines.
- Report given to the agent: "The provider says the webhook was delivered, but we reject it or say the body was already read."
- Root cause: Web Request bodies are consumable streams. Parsing and reserializing also changes the bytes covered by a signature.
- Why it gets written: Old convenience body-reader behavior can hide stream ownership; h3 v2 foregrounds native Request methods [H1, H2].
- Verification: Sign exact bytes containing whitespace and reordered JSON keys. Accept the original once, reject altered bytes and bad signatures, and prove the business handler receives the verified parsed object.
- Solutions:
  - [best] Read bounded raw bytes once, verify those bytes, then parse and pass the result · one clear owner.
  - [acceptable] Clone the Request before consumption when the body is bounded and the adapter supports it · preserves independent reads.
  - [over-engineered] Add a webhook relay service to normalize JSON · changes signature semantics and architecture.
  - [wrong] Verify `JSON.stringify(await request.json())` or skip verification after a read error · wrong bytes or missing authentication.
- Agent traps: Assume `readBody` always caches across every h3 v2 release; claim a body read fails without checking the pinned utility.
- Evidence: Synthetic signed-webhook case; real body-reuse report [h3js/h3#1241](https://github.com/h3js/h3/issues/1241), read in full, and native body migration [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md).
- Difficulty: 4 · Static-detectable: yes

### SOL-19 A proxy drops the second auth cookie

- Type: B (hidden) · Class: migration · Primitive(s): h3 v2 Headers, Auth
- Fixture: Legacy session proxy in viewer; copy upstream Set-Cookie via a single-value header or comma split, 3-7 lines.
- Root cause: Multiple cookies require preserving each Set-Cookie field. A comma is also legal inside an Expires attribute, so naive splitting corrupts values.
- Why it gets written: Most headers can be treated as a single string; cookies are the exception and the migration explicitly calls out `getSetCookie` [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md).
- Verification: Outside B, mock two cookies including an Expires date. Both reach the browser unchanged, sign-in persists, and sign-out expires both. Test through the actual runtime adapter.
- Solutions:
  - [best] Return the upstream Response when suitable, or append each `headers.getSetCookie()` value · preserves multiplicity.
  - [acceptable] Use a proven Set-Cookie parser for an adapter lacking native access · handles Expires correctly.
  - [over-engineered] Implement a browser-side cookie forwarding protocol · needless and risks HttpOnly semantics.
  - [wrong] Split the combined string on every comma · corrupts Expires.
- Agent traps: Use `headers.set` repeatedly, overwriting earlier cookies; attempt to read HttpOnly response cookies from browser JavaScript.
- Evidence: Synthetic; h3 v2 cookie/header migration [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md).
- Difficulty: 3 · Static-detectable: yes

### SOL-20 Nuxt 3 server code after a Nuxt 5 upgrade

- Type: both · Class: migration · Primitive(s): Nuxt server imports, h3 v2, Nitro v3
- Fixture: Frozen legacy Meetups branch with several server helpers importing `h3` v1, `nitropack/runtime` and implicit globals; 4-6 files, 25-50 changed lines.
- Report given to the agent: "Upgrade our old Nuxt site to Nuxt 5. The API should behave the same and still deploy to Workers."
- Root cause: Old server imports and Node-specific request access target a different server engine and event contract.
- Why it gets written: Nuxt app composables, Nuxt server helpers, raw h3 and standalone Nitro have different import contracts; an import-only codemod cannot infer response/lifetime changes [N5, H1, T1].
- Verification: Build on the exact target lockfile; exercise auth, validation, redirect, upload and error responses on a Worker-compatible adapter. Check response behavior, not absence of legacy strings.
- Solutions:
  - [best] Use supported `nuxt/server` exports plus needed `nitro/*` APIs and migrate incompatible Request/Response operations · follows the chosen engine.
  - [acceptable] Keep explicitly supported compatibility aliases while proving Nuxt 5/Nitro v3/h3 v2 behavior · valid spelling is not a failure.
  - [over-engineered] Reimplement a private copy of all h3 v1 helpers · broad maintenance burden.
  - [wrong] Downgrade Nitro/h3 or retain a second h3 v1 runtime to satisfy imports · violates the target stack.
- Agent traps: Fail `defineEventHandler` or `createError` solely for being aliases; the current Nuxt guide explicitly supports its facade [N5](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/20.upgrade.md).
- Evidence: Synthetic migration built from current Nuxt upgrade guidance [N5](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/20.upgrade.md), Nitro migration [T1](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/99.migration.md), and h3 migration [H1](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md). Existing Nuxt 5 reference uses explicit `nuxt/server` imports [F1](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/api/events/[slug]/rsvp.post.ts).
- Difficulty: 4 · Static-detectable: yes

### SOL-21 TypeScript config no longer loads natively

- Type: both · Class: migration · Primitive(s): Nuxt 5 config loading, Node ESM
- Fixture: Legacy Meetups config imports an extensionless helper that contains a TypeScript enum; two small files, 5-12 lines.
- Report given to the agent: "Our Nuxt upgrade fails before it starts building. The config worked for years."
- Root cause: Native config loading no longer supplies every transformation/resolution behavior previously supplied by `jiti`.
- Why it gets written: Application code is bundled, but config and local modules load outside that bundler. A working TypeScript import in app code is not proof it works in config [N5](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/20.upgrade.md).
- Verification: Load config and build using the pinned supported Node version from a clean dependency install; verify the intended settings survive. Typecheck the config's Node context rather than only app code.
- Solutions:
  - [best] Use explicit real file extensions and erasable TypeScript in the small local helper · matches native loading.
  - [acceptable] Install the documented optional `jiti` fallback where a dependency needs it · a supported migration choice, not cheating.
  - [over-engineered] Add a separate transpilation pipeline for two config helpers · excessive.
  - [wrong] Set the app tsconfig to suppress the diagnostic · does not change runtime loading.
- Agent traps: Strip all TypeScript from the app; claim Nuxt 5 cannot load TypeScript configuration; apply this case to a nightly predating the behavior.
- Evidence: Synthetic migration; current Nuxt upgrade guide describes native loading, extension rules, enums and optional fallback [N5](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/20.upgrade.md). Target admission requires reproducing it on the chosen pin.
- Difficulty: 3 · Static-detectable: yes

### SOL-22 Nitro upgrade silently loses routes and tasks

- Type: both · Class: migration · Primitive(s): Nitro v3 scanning, tasks, imports
- Fixture: Small standalone Nitro mail-sync companion; retain a v2 config without explicit scanning and old global helpers, 3 files, 10-20 lines.
- Report given to the agent: "The server starts after the upgrade, but the sync endpoint is 404 and scheduled sync never happens."
- Root cause: Standalone Nitro v3 does not scan server directories by default, and v2 auto-import assumptions are no longer valid.
- Why it gets written: The directory tree still looks correct, and a listening process is a misleading success signal [T1, T3].
- Verification: Enumerate behavior through the production adapter: sync route responds, the intended task can be invoked, and the generated supported-host schedule targets it. Anonymous task-trigger routes remain denied.
- Solutions:
  - [best] Configure scanning or register handlers/tasks explicitly, use supported imports, and wire the selected host's scheduling · restores actual registration.
  - [acceptable] Register a finite set of routes/tasks programmatically · correct without prescribed file layout.
  - [over-engineered] Write a replacement filesystem scanner · duplicates Nitro.
  - [masks-symptom] Add an unrelated health route and declare migration complete · missing functionality remains.
- Agent traps: Apply standalone Nitro defaults to Nuxt, whose integration supplies configuration; mistake file existence for task registration; ignore host scheduling support.
- Evidence: Synthetic; standalone migration [T1](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/99.migration.md) and tasks docs [T3](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/50.tasks.md). Nuxt versus standalone must be explicit in the fixture manifest.
- Difficulty: 4 · Static-detectable: yes

### SOL-23 The old shared cache became per-instance memory

- Type: both · Class: migration · Primitive(s): Nitro cache, KV, ViteHub cache configuration
- Fixture: Legacy Meetups rates loader; preserve old cache assumptions after moving NuxtHub/Nitro versions, 1 config block and 1 loader, 8-15 lines.
- Report given to the agent: "The rates bill jumped after migration. Every fresh worker seems to call the provider again."
- Root cause: Cached function entries land in an instance-local backend rather than the intended shared store, or the old custom storage mount is no longer selected by the new cache engine.
- Why it gets written: A helper named `defineCachedFunction` still returns cached values locally even when persistence and sharing changed underneath it [T1, T2, V6].
- Verification: Use two isolated runtime instances and a counting rates stub, advance a fake clock across expiry, then restart one instance. Assert declared sharing and freshness semantics; separately test SWR lifetime on the chosen host.
- Solutions:
  - [best] Configure the cache backend supported by the exact Nitro/ViteHub pin and preserve resource identity · shares expensive public data as intended.
  - [acceptable] Use an explicit shared KV-backed cache with TTL and defined failure behavior · correct when the provider integration cannot express the required contract.
  - [over-engineered] Add a separate caching HTTP service · unnecessary infrastructure.
  - [wrong] Increase `maxAge` on an ephemeral per-instance cache and promise cross-instance reuse · lifetime does not create sharing.
- Agent traps: Assume ViteHub `cache: true` config from one revision automatically fits a newer Nitro cache engine; cache user-specific rates/pricing under an incomplete key.
- Evidence: Synthetic; real ViteHub cache integration commit `c5a912e5d9` and inspected source [V6]. Current Nitro migration explicitly documents memory LRU defaults and `cache.driver` [T1, T2]; these contracts must be reconciled at fixture freeze.
- Difficulty: 4 · Static-detectable: partly

### SOL-24 NuxtHub data survives imports but not migration history

- Type: both · Class: migration · Primitive(s): Database, Drizzle, D1
- Fixture: Legacy Meetups using `hubDatabase`-era code plus a populated `_hub_migrations` database; migrate to the selected ViteHub Database API. Four small files and a seed DB.
- Report given to the agent: "Move our old NuxtHub site to ViteHub. Keep all events and existing accounts."
- Root cause: Renaming imports does not migrate existing resource identity, local data paths, or the history ledger used by a different migration runner.
- Why it gets written: Both products expose SQLite/Drizzle-like access, making the deployment change appear syntactic [V7].
- Verification: Migrate a disposable populated legacy DB; preserve IDs, foreign keys and row checksums, then apply a new schema change exactly once. A separate empty-database bootstrap must also work.
- Solutions:
  - [best] Keep the existing DB identity, reconcile a proven schema baseline with the selected runner, then apply only new changes · preserves data and future migration integrity.
  - [acceptable] Export/import into a new explicitly selected DB with full integrity checks and a documented cutover · more work but valid.
  - [over-engineered] Maintain parallel custom migration frameworks permanently · avoidable ownership.
  - [wrong] Replay all legacy SQL into the populated DB or delete it to make migrations pass · destroys or conflicts with existing state.
- Agent traps: Copy the source checkout's old `server/databases/config.ts` convention into a newer fixture and grade directory names; use a no-op baseline as the only fresh-install schema.
- Evidence: Synthetic legacy plant; inspected official migration guide explains `_hub_migrations`, resource identity and D1 baselining [V7]. Its table covers NuxtHub 0.10, not every historical `hubDatabase` release; freeze the legacy revision rather than inventing its contract.
- Difficulty: 5 · Static-detectable: partly

### SOL-25 Generated auth migration deletes related records

- Type: both · Class: migration · Primitive(s): Database, Drizzle Kit, Auth, D1
- Fixture: Site-derived small viewer DB; add auth organization tables while generated SQL unnecessarily rebuilds a parent user table, one migration plus seeded relationships.
- Report given to the agent: "After the auth upgrade, accounts still exist but sessions and passkeys disappeared."
- Root cause: Dropping/recreating a referenced table under the target's foreign-key behavior can cascade-delete child rows, even when parent rows are copied back.
- Why it gets written: Generated SQL looks authoritative, and schema equivalence says nothing about the intermediate data operations [R2, D1].
- Verification: Apply the migration to a disposable copy with users, sessions, accounts, passkeys and organization relationships. Compare row identities/checksums and `foreign_key_check`; verify sign-in and passkeys afterward on the actual target semantics.
- Solutions:
  - [best] Remove unnecessary rebuilds and apply only the required additive changes, after proving schema compatibility · the actual site fix.
  - [acceptable] Use a reviewed data-preserving rebuild procedure supported by the selected D1/SQLite migration runner · necessary for genuine structural changes.
  - [over-engineered] Replace the ORM or database solely for one generated migration · broad unrelated risk.
  - [wrong] Prepend `PRAGMA foreign_keys=OFF` and assume D1 honors it in the migration transaction · requires target-specific proof.
- Agent traps: Check only parent row counts; treat local SQLite success as sufficient proof for D1; regenerate and overwrite applied migration history.
- Evidence: Real nuxt-evals fix `6b37d2d68d448e17c81a32f958064bcc2288067d`, `site/server/databases/default/migrations/20261112195329_auth_organizations/migration.sql`, diff read [R2](/home/maxi/vitehub/nuxt-evals/site/server/databases/default/migrations/20261112195329_auth_organizations/migration.sql). Independent real report [drizzle-team/drizzle-orm#4938](https://github.com/drizzle-team/drizzle-orm/issues/4938), read in full [D1](https://github.com/drizzle-team/drizzle-orm/issues/4938).
- Difficulty: 5 · Static-detectable: yes

### SOL-26 Deployment succeeds without applying schema changes

- Type: both · Class: migration · Primitive(s): Database migrations, Cloudflare deployment
- Fixture: Legacy Meetups release script builds and deploys but omits migrations; one script line plus a new additive schema change.
- Report given to the agent: "The deployment was green, but production says the reminders column doesn't exist."
- Root cause: The build/deploy lifecycle does not automatically apply the new migration ledger to the selected remote database.
- Why it gets written: Earlier integration behavior and a successful build can imply migrations happened, while deployment and database updates are separate operations [V7, NH1].
- Verification: In a disposable deployment simulation, start from the previous populated schema, execute the release sequence, then call the feature and inspect the migration ledger. A repeat release must not reapply SQL; a migration failure must stop deployment.
- Solutions:
  - [best] Make the release sequence explicitly apply reviewed migrations to the correct generated resource config before deploying compatible code · clear lifecycle ownership.
  - [acceptable] Separate migration and deployment CI stages with a required successful dependency · equivalent sequencing.
  - [over-engineered] Run schema mutation on every HTTP request · costly and race-prone lifecycle.
  - [masks-symptom] Catch missing-column errors and return empty reminders · conceals an incomplete release.
- Agent traps: Run the migration only against local development DB; let a migration failure continue into deployment.
- Evidence: Real report [nuxt-hub/core#861](https://github.com/nuxt-hub/core/issues/861), read body [NH1](https://github.com/nuxt-hub/core/issues/861); ViteHub migration docs [V7]. Working release-sequence example checked at `site/package.json:9`.
- Difficulty: 3 · Static-detectable: yes

### SOL-27 A KV migration treats an error tuple as data

- Type: both · Class: migration · Primitive(s): KV, NuxtHub
- Fixture: Mail-sync cursor or Meetups settings migration; change the import but retain throwing/direct-value handling, 3-8 lines.
- Report given to the agent: "After moving to ViteHub the saved settings are an array, and storage failures look like successful saves."
- Root cause: The selected ViteHub KV method returns `[error, value]`; a legacy caller uses the tuple as the value or expects provider failures to throw.
- Why it gets written: Familiar method names survive the migration while the failure contract changes [V3, V7].
- Verification: Inject success, not-found and expected provider failure for `get` and `set`. Failures must produce the declared HTTP/job failure; no cursor advances on a failed write. Test TTL only on a driver that supports the required semantics.
- Solutions:
  - [best] Unwrap and handle the documented result at the existing boundary · explicit failure policy.
  - [acceptable] Use one small shared unwrap helper when repeated callers need the same throw policy · removes repetition without hiding intent.
  - [over-engineered] Wrap every ViteHub feature in a new storage abstraction · too broad.
  - [wrong] Return `result[1]` and silently ignore `result[0]` · turns outages into missing settings.
- Agent traps: Assume invalid configuration also becomes a tuple; the inspected implementation can still throw configuration errors. Invent atomic locking on an eventually consistent KV driver.
- Evidence: Synthetic; runtime `packages/kv/src/runtime/storage.ts:88` and methods at line 98 [V3]; NuxtHub migration contract [V7].
- Difficulty: 2 · Static-detectable: yes

### SOL-28 The migrated upload accepts someone else's object path

- Type: both · Class: security · Primitive(s): Blob, Auth, upload validation
- Fixture: Meetups event cover upload; import the new upload helper but trust client-supplied owner/path, 8-15 lines. Keep the existing size/content checks correct.
- Report given to the agent: "A user can replace another organizer's event cover by changing the upload request."
- Root cause: Storage convenience methods do not establish application ownership. A client-supplied owner or path is not an authorization decision.
- Why it gets written: Migrating from hand-written upload code to a helper can accidentally remove checks that belonged to the application [V4].
- Verification: Anonymous and wrong-organizer uploads write zero objects; path traversal/cross-owner names fail. Existing size/content checks still reject invalid images; valid images succeed and remain viewable. Verify errors are unwrapped.
- Solutions:
  - [best] Authorize the event, derive its storage key on the server, and retain the Blob upload constraints · separates ownership policy from storage.
  - [acceptable] Retain a small existing bounded upload handler using `blob.put` and equivalent checks · correct even without the highest-level helper.
  - [over-engineered] Build a full media pipeline for simple cover images · unnecessary unless specified.
  - [wrong] Trust `file.type` or the client owner ID · trivially bypassable.
- Agent traps: Check only that a session exists; remove existing validation during the repair; claim `ensureBlob` alone proves full content safety [V4].
- Evidence: Synthetic; Blob APIs and validation implementation verified [V4]. No live authorization bug in Meetups is claimed.
- Difficulty: 3 · Static-detectable: yes

### SOL-29 An R2 binding cannot sign a browser upload

- Type: both · Class: nook · Primitive(s): Blob, R2 signing, Env
- Fixture: Meetups direct-cover-upload route configured only with an R2 binding; 5-10 lines and one config block.
- Report given to the agent: "Normal photo uploads work in Workers, but the new direct upload button always fails to get a URL."
- Root cause: Binding access for server reads/writes does not provide the S3-compatible signing credentials required for presigned direct requests.
- Why it gets written: One Blob API hides driver differences, but signing has an explicit capability and credential contract [V4].
- Verification: With a binding-only mock, the chosen fallback succeeds or returns a precise supported error. With a signing-capable test provider, browser PUT sends all signed headers and respects expiry/content type. No credentials enter payload or bundle.
- Solutions:
  - [best] Use binding-backed `handleUpload`/supported multipart when no direct-signing requirement exists · fits the available capability.
  - [acceptable] Configure signing credentials through the supported server environment and preserve the returned request headers · valid for required direct uploads.
  - [over-engineered] Add a separate always-on upload proxy solely to avoid using the existing binding path · unnecessary.
  - [wrong] Put signing keys in runtimeConfig.public or manufacture a URL from the bucket name · leaks credentials or produces an unsigned URL.
- Agent traps: Demand a key merely because signing is available; assume an R2 binding supports every operation.
- Evidence: Synthetic; checked `docs/content/docs/blob/server-api.md:237` and migration guide lines 115-119 [V4, V7].
- Difficulty: 3 · Static-detectable: yes

### SOL-30 Replace the old home-made session service

- Type: both · Class: migration · Primitive(s): Auth, Database, Better Auth
- Fixture: Legacy Meetups with custom password/session routes and a populated DB; 5-8 short files, roughly 80-150 lines of old auth logic.
- Report given to the agent: "Move sign-in to ViteHub Auth. Existing people must still be able to get in."
- Root cause: A superficial replacement can leave two authorities for session identity, or discard incompatible account/password/session data without a migration policy.
- Why it gets written: A login form working once hides account-ID compatibility, password-hash compatibility, cookie invalidation and every protected API's identity source [V2].
- Verification: Seed existing users, relations and a known legacy password format. Verify the agreed password migration/reset path, stable user IDs, signup, logout, expired sessions, and protected API denial. An old untrusted cookie must not bypass the new authority.
- Solutions:
  - [best] Adopt the verified Auth definition/guards, migrate compatible account data deliberately, and remove old session authority · one source of identity.
  - [acceptable] Use a bounded dual-read password migration or explicit reset flow with stated user impact · fits incompatible hashes.
  - [over-engineered] Maintain both complete auth systems indefinitely · doubles policy and revocation paths.
  - [wrong] Keep accepting any legacy cookie after switching the UI · apparent migration with an auth bypass.
- Agent traps: Promise existing plaintext passwords can be recovered; silently force resets despite an explicit continuity requirement; grade a custom migration helper as automatically bad.
- Evidence: Synthetic product migration, built only on verified `defineAuth`, server instance and guard APIs [V2]. Legacy schema/hash format must be supplied by the fixture, not guessed.
- Difficulty: 5 · Static-detectable: partly

### SOL-31 An in-process cron vanishes on serverless

- Type: both · Class: migration · Primitive(s): Schedule, Nitro tasks, host output
- Fixture: Legacy Meetups reminder plugin using `setInterval`; move deployment to a supported serverless host, 10-20 lines.
- Report given to the agent: "Reminders work while dev is open, but nobody gets them after deployment."
- Root cause: A timer in a request-serving process does not establish a durable host wake-up, and several replicas can each run their own timer.
- Why it gets written: Development has one long-lived process; production hosting changes execution lifetime and multiplicity [T3, V5].
- Verification: Inspect generated host cron output and invoke a scheduled occurrence through the target adapter. Restart the app and replay an occurrence; expected reminders remain scheduled and duplicate effects are bounded by the delivery policy.
- Solutions:
  - [best] Use a discovered ViteHub `defineSchedule` and supported host wake output, keeping reminder logic idempotent · adopts the intended scheduler.
  - [acceptable] Use supported Nitro tasks/scheduledTasks with equivalent host wiring · correct mechanism; record ViteHub preference separately.
  - [over-engineered] Add a standalone workflow orchestration service for one daily reminder sweep · excessive.
  - [wrong] Increase interval frequency or make an unauthenticated task-trigger endpoint · no reliable wake contract and possible abuse.
- Agent traps: Claim a schedule definition alone guarantees execution on every host; overlook disabled provider output or memory-only runtime schedule storage.
- Evidence: Synthetic; `defineSchedule` exists at `packages/schedule/src/definition.ts:27`, documented host/wake constraints [V5], and Nitro task platform support [T3](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/50.tasks.md).
- Difficulty: 3 · Static-detectable: yes

### SOL-32 RSVP waits for a slow email provider

- Type: both · Class: perf · Primitive(s): Queue, Email, Database
- Fixture: Meetups RSVP route; replace enqueueing with awaited delivery, 3-6 lines.
- Report given to the agent: "Booking takes several seconds. Sometimes it says it failed even though my seat was saved."
- Root cause: The booking response is coupled to slow/fallible email delivery after the durable reservation succeeds.
- Why it gets written: Sequential `await` reads naturally, but combines separate user-visible success conditions and retry policies [F1, V8].
- Verification: A mailer held behind a barrier must not hold the booking HTTP response. Release/fail the mailer, execute the job, and prove the reservation persists and the confirmation eventually follows the stated retry policy.
- Solutions:
  - [best] Dispatch through the supported ViteHub Queue and define the enqueue-failure policy · separates reservation from delivery.
  - [acceptable] Use a transactionally recorded outbox consumed by the existing queue when the requirement forbids lost confirmations · closes the DB/enqueue gap.
  - [over-engineered] Introduce a general event bus plus several delivery services · unnecessary here.
  - [wrong] Start an unobserved `sendMail()` promise or use only process memory · response can finish before durable work exists.
- Agent traps: Claim queueing is atomic with the booking write; use `waitUntil` as proof of durable retries; copy a tuple-return pattern from the wrong ViteHub version.
- Evidence: Synthetic reversal of the checked reference RSVP route and queue definition [F1](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/api/events/[slug]/rsvp.post.ts); verified Queue APIs [V8]. Reference permits logged enqueue failure, so guaranteed delivery is a separate harder variant, not a hidden rubric demand.
- Difficulty: 3 · Static-detectable: yes

### SOL-33 Retrying a job sends a second confirmation

- Type: both · Class: bug · Primitive(s): Queue, Email, Database
- Fixture: Meetups confirmation job; remove the stable effect identity or provider idempotency key and inject a failure after external send, 5-10 lines.
- Report given to the agent: "Some people get the same confirmation twice when the mail service is flaky."
- Root cause: Retrying a job after an ambiguous external success can repeat its side effect. Enqueue dedupe is not the same guarantee as effect dedupe.
- Why it gets written: A Queue option named `idempotencyKey` invites assuming exactly-once execution across all providers and crash windows [V8].
- Verification: Mock provider success followed by a lost acknowledgement, then redeliver the job. For a provider supporting idempotency, assert one delivered message and successful eventual completion. Add separate duplicate enqueue tests.
- Solutions:
  - [best] Use a stable effect key with a mail provider that honors it, and persist delivery state as needed · handles ambiguous retries at the external boundary.
  - [acceptable] Explicit at-least-once delivery with deduplication where available · only acceptable when the product allows occasional duplicate mail.
  - [over-engineered] Add distributed consensus around the whole booking flow · cannot alone make an unrelated mail API transactional.
  - [wrong] Mark sent before sending or disable retries globally · trades duplicates for lost mail.
- Agent traps: Claim a DB boolean alone closes both crash windows; assume the selected Cloudflare/Queue adapter honors the same enqueue options as Vercel.
- Evidence: Synthetic; inspected Queue provider-specific send options and runtime API [V8]. The expected guarantee and mock provider capability must be explicit in the case contract.
- Difficulty: 5 · Static-detectable: partly

### SOL-34 A workflow repeats the completed side effect

- Type: both · Class: migration · Primitive(s): Workflow, Queue, external effects
- Fixture: Mail-sync onboarding or document-analysis fixture; migrate a promise chain into one large workflow handler without effective durable boundaries, 15-30 lines.
- Report given to the agent: "If analysis fails near the end, retrying creates another document and sends the welcome message again."
- Root cause: The flow retries a larger unit than the intended side effect, or external effects lack stable idempotency despite step retries.
- Why it gets written: Naming a function a workflow does not make every line exactly-once; providers expose different durable-step mechanisms [V9].
- Verification: Fail after document creation, restart the selected provider runtime, resume, and assert one document, one permitted notification and completed final state. Check status through the actual workflow API.
- Solutions:
  - [best] Use the selected provider's supported durable step contract and stable external-effect keys · persists progress and handles retries honestly.
  - [acceptable] A small DB-backed state machine/outbox for the required states · correct when that is simpler or the adapter lacks needed durability.
  - [over-engineered] Nest queues and workflows around every pure computation · adds state without value.
  - [wrong] Wrap the whole handler in an unlimited retry loop · repeats completed effects and can never settle.
- Agent traps: Invent a universal `step.do` on all ViteHub providers; assume the workflow directive alone handles external idempotency.
- Evidence: Synthetic; Workflow definition/export/types and provider-specific native examples verified [V9]. README explicitly requires idempotent side-effecting steps.
- Difficulty: 5 · Static-detectable: partly

### SOL-35 The last seat is reserved twice

- Type: both · Class: bug · Primitive(s): Database, Drizzle, SQLite/D1
- Fixture: Meetups RSVP route; replace atomic conditional insertion with separate availability read and insert, 8-15 lines.
- Report given to the agent: "Seats left went negative when two people booked the last seat together."
- Root cause: The application checks a condition against an old snapshot, then writes after another request changed it.
- Why it gets written: A sequential handler looks serialized locally, while separate HTTP requests and database statements interleave [F1](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/api/events/[slug]/rsvp.post.ts).
- Verification: Barrier two distinct users after the availability read, release together, and require exactly one new RSVP. Also test duplicate clicks, organizer capacity reduction, cancellation and an already-started event.
- Solutions:
  - [best] Encode availability and insertion in one supported atomic conditional statement plus a uniqueness constraint · database owns the invariant.
  - [acceptable] Use a transaction/isolation mechanism actually supported by the chosen adapter · prove both requests cannot commit.
  - [over-engineered] Put all bookings through a new global queue/lock service · avoidable latency and coordination.
  - [wrong] Disable the browser button or use a process-local mutex · other clients/instances still race.
- Agent traps: Use a D1 transaction API the adapter does not support; pass only repeated requests from one user, where uniqueness masks capacity races.
- Evidence: Synthetic reversal of the checked atomic SQL in `tasks/meetups/reference/server/api/events/[slug]/rsvp.post.ts:18` [F1](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/api/events/[slug]/rsvp.post.ts). No historical oversell in the reference is claimed.
- Difficulty: 4 · Static-detectable: yes

### SOL-36 One attendee count query per event

- Type: both · Class: perf · Primitive(s): Database, Drizzle
- Fixture: Meetups dashboard/list repository; count attendees inside a per-event loop, 8-15 lines.
- Report given to the agent: "The dashboard gets slower every time we add more events."
- Root cause: A list operation performs a dependent query per row rather than computing the required aggregates in a bounded number of queries.
- Why it gets written: Reusing a correct `seatsLeft(eventId)` helper inside a list hides query multiplicity; Promise.all changes latency but not query count [F1, V1].
- Verification: Seed 1, 20 and 200 events with zero/multiple attendees. Count driver queries and assert a fixed bound while checking exact totals and pagination. Use counting, not machine-dependent milliseconds.
- Solutions:
  - [best] Aggregate counts with a correctly grouped query or a bounded batch lookup · removes multiplicative I/O.
  - [acceptable] Denormalize a count with proven atomic updates/reconciliation if read pressure justifies it · introduces a maintenance invariant.
  - [over-engineered] Add a cross-service batching layer for one repository function · unnecessary.
  - [masks-symptom] Parallelize every row query or cache the entire private dashboard · query work or cache risk remains.
- Agent traps: Incorrect inner joins omit zero-attendee events; COUNT on an outer join counts the placeholder row; lose authorization filtering when batching.
- Evidence: Synthetic; Drizzle access verified [V1]. Drop's real per-request DB instrumentation work, commit `f949cdb7`, supports the measurement method but does not prove that Drop had this N+1 bug [R3].
- Difficulty: 3 · Static-detectable: yes

### SOL-37 Enabling Gmail watch skips the first messages

- Type: both · Class: nook · Primitive(s): KV, Schedule, webhook synchronization
- Fixture: Frozen mail-sync fixture adapted from email-labeller; restore watch-before-cursor order, about 10 lines.
- Report given to the agent: "Right after I turn on push sync, a few emails never get labelled. Later messages work."
- Root cause: Starting the subscription before capturing the baseline cursor lets new messages fall before the stored cursor when initialization later reads current history.
- Why it gets written: Registering push first sounds safer; the cursor/subscription handshake is the real ordering invariant [R4].
- Verification: Inject a message exactly between watch registration and cursor capture, then trigger the first sync. The message must be processed; duplicate notifications must not lose or multiply final effects.
- Solutions:
  - [best] Capture and persist the baseline before enabling watch, then consume subsequent history · the historical repair.
  - [acceptable] Use a provider-supported atomic subscription/cursor handshake if one is actually available · do not invent it.
  - [over-engineered] Reclassify the entire inbox on every push · expensive and ignores cursor correctness.
  - [masks-symptom] Wait several seconds before enabling push · only changes the race window.
- Agent traps: Treat missing pushes as proof the provider is unreliable; advance the cursor before all preceding work is durably handled.
- Evidence: Real email-labeller fix `5f3d3542b664656ea1c7e3b4a446746e587a0eeb`, `server/lib/sync.ts`, before/after read [R4]. Run against a deterministic provider stub, never real Gmail.
- Difficulty: 4 · Static-detectable: partly

### SOL-38 One poison email stops the whole inbox

- Type: both · Class: bug · Primitive(s): Schedule, KV cursor, Agent/external API
- Fixture: Frozen mail-sync fixture; remove per-message failure isolation and retry/skip accounting, 15-30 lines.
- Report given to the agent: "Labelling stopped for hours, but the health endpoint still says everything is fine."
- Root cause: One oversized or repeatedly failing message prevents the cursor from advancing, so every sync retries the same batch while unrelated mail is blocked.
- Why it gets written: All-or-nothing batch handling protects against data loss, but without a bounded poison-item policy it has no route to progress [R5].
- Verification: Feed good, oversized and transient-failure messages across several history pages. Good mail progresses; transient failures retry; persistent failures enter an observable failed/dead-letter state; cursor never skips unrecorded work. Health reflects repeated failure and hides private details from anonymous callers.
- Solutions:
  - [best] Isolate item failures, record bounded retries and a recoverable failure queue/state, and define cursor commit rules · progress with accountability.
  - [acceptable] Stop the batch but expose failure and provide a precise operator retry/quarantine path · acceptable only for explicitly manual recovery requirements.
  - [over-engineered] Split a tiny labeller into several processing services · unnecessary infrastructure.
  - [wrong] Catch every error and advance the cursor without recording failures · silently loses mail.
- Agent traps: Copy the historical three-attempt policy as universal truth; leak message/error details in public health output; increase API result limits without addressing poison items.
- Evidence: Real email-labeller fix `6efc348851fa21894f9e2cce3db46fc89e3edb08`, full relevant diff read [R5]. Commit reports a 100 KB message exceeding Executor's result limit; that size is historical evidence, not a benchmark threshold.
- Difficulty: 4 · Static-detectable: yes

### SOL-39 A workspace read stays on an old revision

- Type: both · Class: nook · Primitive(s): Workspace, Source, request lifetime
- Fixture: Small document viewer based on Console; acquire/cache a workspace view with the wrong request lifetime, 5-12 lines.
- Report given to the agent: "I save a document in one tab, but another tab's file tree keeps showing the old version."
- Root cause: A long-lived view/cache is reused across requests when reads require a refreshed authoritative revision. Concurrent invalidation can also disturb unrelated active readers.
- Why it gets written: A convenient handle resembles a stateless service client, while a workspace view can embody a particular revision/materialization lifetime [V10].
- Verification: Two independent requests/tabs read, one writes, then the other rereads. It sees the committed revision and preserves unrelated files. Add overlapping readers/writers and explicit conflict assertions.
- Solutions:
  - [best] Use the selected build's request/session-scoped workspace access and supported revision/conflict behavior · gives reads the intended lifetime.
  - [acceptable] Explicitly refresh/reacquire the view at a safe request boundary using the documented API · valid for older builds.
  - [over-engineered] Disable every cache and rebuild the full workspace on every filesystem operation · excessive work.
  - [wrong] Force-reset shared cache state halfway through a mutation or overwrite newer revisions unconditionally · risks interference/lost updates.
- Agent traps: Copy an old internal reset helper as a timeless public API; assume request-scoped acquisition alone proves all concurrent-write safety.
- Evidence: Real Console fix `15b8ad9183fa44348d1f39a80b90582ebcb17cc2`, `server/api/repository/[action].ts`, moved reset to the start of each authorized request, diff read [R6]. This is historical evidence, not a recommendation to revive that helper. Current access APIs checked [V10].
- Difficulty: 4 · Static-detectable: partly

### SOL-40 UI slots break because two Vue runtimes load

- Type: A (fix) · Class: dx · Primitive(s): Vue SSR, UI, package resolution
- Fixture: Small viewer with a known duplicated Vue dependency graph; one workspace override/dependency change plus a slot-bearing UI component.
- Report given to the agent: "The app runs until I open the Console. Then the UI slots crash even though the component looks normal."
- Root cause: Nuxt and UI resolve incompatible/distinct Vue runtime instances, so rendering context and slot helpers do not share the expected singleton state.
- Why it gets written: Preview packages, peer ranges and package-manager resolution can duplicate a runtime without an obvious component-code change [R7].
- Verification: Resolve Vue from the actual Nuxt/UI consumers and SSR-render a UI-provided slot through the application's Vue. Verify interactive mounting too; merely counting lockfile version strings is insufficient.
- Solutions:
  - [best] Align compatible Vue/renderer peer versions and dependency resolution so consumers share the intended runtime · fixes the dependency graph.
  - [acceptable] Use a justified package-manager override or bundler dedupe consistent with package exports and peers · verify both SSR and client.
  - [over-engineered] Rewrite working UI components to avoid all slots · hides the graph problem at large scope.
  - [masks-symptom] Make the entire Console client-only or suppress render errors · other runtime-context failures remain.
- Agent traps: Change component lifecycle hooks at random; pin an incompatible Vue version to satisfy a superficial singleton check.
- Evidence: Real Calories fix `075a9f1a2feb88e05e3a69ed2444e544d014950f`, `pnpm-workspace.yaml` and `test/vue-runtime.test.ts`, both diff read [R7]. Historical repair used Vue 3.5.41; do not prescribe that version for the current fixture.
- Difficulty: 4 · Static-detectable: partly

## The first 20 to build

This order favors cheap calibration and different causal mechanisms. It is a proposed order, not an estimate backed by runtime measurements.

| Order | Case | Why it belongs in the first set |
| --- | --- | --- |
| 1 | SOL-02 Double setup fetch | Small plant, simple request-count oracle, checks SSR knowledge. |
| 2 | SOL-03 Shared async-data key | Distinct from request duplication; tests resource identity and shared state. |
| 3 | SOL-01 SSR identity forwarding | Common-looking symptom with a precise server/client boundary. |
| 4 | SOL-06 Shallow-data migration | Tests changed framework defaults without requiring a large rewrite. |
| 5 | SOL-07 Payload projection | Separates real data reduction from compression or UI-only changes. |
| 6 | SOL-08 Module-scoped user state | High-impact B case; contrast with a safe fixed-key `useState` control. |
| 7 | SOL-10 Async watcher ownership | Strong static signal and a different lifetime boundary from SSR requests. |
| 8 | SOL-11 Lazy auth client | Real app history, bundle evidence, possible match for Maxi's remembered example. |
| 9 | SOL-13 Stale cookie policy | Forces a performance/freshness decision rather than blind caching. |
| 10 | SOL-14 Private response cache | Tests output identity and cache boundaries, not cookie-signature knowledge. |
| 11 | SOL-16 Missing return after redirect | Small h3 migration with a direct side-effect oracle. |
| 12 | SOL-17 Middleware prefix change | Another h3 migration; security depends on route matching rather than control flow. |
| 13 | SOL-20 Nuxt 3 server code to Nuxt 5 | A bounded end-to-end migration, with aliases accepted when valid. |
| 14 | SOL-24 NuxtHub database history | Captures the hard part import renaming misses: preserving an existing deployment. |
| 15 | SOL-25 D1 cascade migration | Real site repair; distinguishes schema correctness from data safety. |
| 16 | SOL-27 KV tuple migration | ViteHub-specific contract, cheap fault injection, straightforward static variant. |
| 17 | SOL-31 Timer to host schedule | Legacy code predating the primitive; requires actual wake wiring. |
| 18 | SOL-32 Email on the request path | Clear user latency symptom and a meaningful Queue choice. |
| 19 | SOL-35 Concurrent last seat | Tests whether the fix places the invariant at the database boundary. |
| 20 | SOL-38 Poison-message progress | Real multi-step app failure; rewards root-cause repair and honest health reporting. |

For the first B pack, combine compatible SOL-03, SOL-08 and SOL-16 plants in Meetups. A second viewer pack can combine SOL-10, SOL-15 and SOL-19. Keep each bug's inputs and oracle independent, and verify that one fix does not accidentally remove another. Never expose these pack IDs or planted locations to the scanning agent.

Include pristine versions and safe near-misses: immutable module schemas, request-local `useState`, deliberate shared keys with identical loaders, public response caches, bounded explicit watchers with cleanup, and an atomic SQL capacity check. Vary bug counts, including zero, without giving the agent a quota. A confident warning against one of these controls should reduce precision. Proposed severity anchors: cross-user disclosure or unauthorized mutation highest; irreversible migration loss next to other critical data loss; blocked core flows next; performance and cosmetic inconsistency below those. Freeze the precise severity per fixture and user impact rather than deriving it from the bug's name.

For implementation, make the proposed match rubric explicit: best 15/15, acceptable 12/15, over-engineered 6/15, masks-symptom or wrong 0/15. Conditional rankings depend on the fixture's stated guarantees, such as permitted delivery duplicates. Root-cause credit is 15 for the causal invariant, 7 for an incomplete causal explanation, and 0 for a symptom or false cause. An equivalent correct mechanism can earn full primitive-use credit; supported direct SQL is not a penalty. Score minimality separately for unnecessary concepts introduced by this patch. For B, weighted recall is matched planted severity weight divided by total planted severity weight; precision is supported distinct findings divided by all actionable distinct findings. On a clean fixture, no findings earns full precision and any unsupported finding reduces it. Track clean-fixture false-positive rate separately. Do not turn a cautious statement into a true positive without a concrete causal claim.

## Open questions for Maxi

1. Which exact issue, PR or app did "Vue portal" mean? The strongest candidate found is Drop's lazy Better Auth client and scope/context repair, commit `f949cdb7`, referencing ViteHub #2692. Another, weaker candidate is ViteHub Workspace session performance, commit `3ca9ba9bd4`. Neither establishes that remembered name; this match is a guess.
2. Which single ViteHub/Nuxt/Nitro build should define the first corpus version? The inspected source and the existing fixtures disagree, as documented below. I recommend freezing one compatible tuple before implementing plants.
3. Should the first migration gates include D1 as well as SQLite? D1 data preservation, binding capabilities and host wake output need target-specific evidence. Local SQLite alone cannot settle all of them.
4. For confirmations, is best-effort enqueueing acceptable, or must every committed RSVP eventually produce a confirmation? This decides whether the outbox in SOL-32 is necessary or excess machinery. Is occasional duplicate email acceptable when the provider cannot deduplicate ambiguous sends?
5. How much migration continuity is required: unchanged user IDs and passwords, or a documented reset/cutover path? SOL-30 needs that contract before solutions can be ranked honestly.
6. After the no-skills baseline is calibrated, should the same new cases join the existing tooling comparison, or remain a separate diagnosis benchmark? The proposals here do not give skills to the baseline agent.

## Evidence ledger and verified APIs

All paths in the ViteHub table are relative to `/home/maxi/vitehub/vitehub`. I inspected source at checkout HEAD `451425205fbecd59fe0b069c9ba107e9d23f67d7`; I did not fetch, change branches or update that checkout. Consumer histories and online main-branch docs can describe later contracts. These are separate evidence snapshots, not a claim that all versions are interchangeable.

The existing Meetups manifest pins ViteHub `1e807fc9fbbfb9c092c9445b2bd1f8325f926dda`, Nuxt nightly `5.0.0-2611070044-e3875e8`, Nitro `3.0.261103-rc`, h3 `2.0.8`, Better Auth `1.7.15`, Vue `3.5.44`, and Drizzle `0.45.4`. Checked at [reference/package.json](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/package.json:18). The site uses the same Nuxt/Nitro/h3 family but ViteHub `1ed1c37df3ea0b73bc3d11b87a9b37129641387f` and Drizzle `1.0.0-rc.5`, checked at [site/package.json](/home/maxi/vitehub/nuxt-evals/site/package.json:20).

Important checked differences:

- The inspected ViteHub source uses `preset` in `packages/vite-hub/src/index.ts:262`; the later site migration commit `0bb47fe` says it moved to `host`. Do not prescribe one option to every fixture.
- The inspected `useDatabase` is exported by `packages/database/src/drizzle.ts:34`. The later site's history says its facade import moved to `vite-hub/database`. Do not grade imports from a different revision.
- The inspected Queue `runQueue` returns `Promise<QueueSendResult>` at `packages/queue/src/runtime/client.ts:141`, with a direct acknowledgement shape at `packages/queue/src/types.ts:159`. The reference RSVP caller expects an error tuple from its different pin. I did not independently inspect the installed package implementation for that pin. Copying either expectation without checking the fixture can produce a fake failure.
- The inspected auth Vue entry imports Better Auth eagerly at `packages/auth/src/vue.ts:1`. Drop's later patch implements `loadAuthClient`; that name was not verified as an export in this source snapshot. SOL-11 explicitly allows a feature-boundary import when the selected build lacks the helper.
- Current online Nitro docs use `defineCachedHandler` and an ocache-backed cache configuration. Inspected ViteHub cache docs still describe a Nitro storage mount and older helper names. A corpus author must freeze and validate the adapter combination before selecting the exact configuration.

| ID | API verified to exist | Source inspected |
| --- | --- | --- |
| V1 | `defineDatabase`, Drizzle `db`/`schema`, `useDatabase(name)` | [definition.ts:16](/home/maxi/vitehub/vitehub/packages/database/src/definition.ts:16), [drizzle.ts:29](/home/maxi/vitehub/vitehub/packages/database/src/drizzle.ts:29). SQLite/libSQL/D1 and migration differences are documented in V7. No invented transaction helper is required. |
| V2 | `defineAuth`, discovered `auth` proxy, `withAuth`, `withAuthorization`, session reading; input supports `disableCookieCache` | [definition.ts:131](/home/maxi/vitehub/vitehub/packages/auth/src/definition.ts:131), [server.ts:370](/home/maxi/vitehub/vitehub/packages/auth/src/server.ts:370), [server.ts:389](/home/maxi/vitehub/vitehub/packages/auth/src/server.ts:389), [server.ts:457](/home/maxi/vitehub/vitehub/packages/auth/src/server.ts:457), [session.ts:4](/home/maxi/vitehub/vitehub/packages/auth/src/session.ts:4), [vue.ts:1](/home/maxi/vitehub/vitehub/packages/auth/src/vue.ts:1). Provider calls still determine freshness; a guard is not a magic authorization policy. |
| V3 | `kv.get`, `set`, `del`, `list`, named stores, error/value results | [storage.ts:88](/home/maxi/vitehub/vitehub/packages/kv/src/runtime/storage.ts:88), [storage.ts:98](/home/maxi/vitehub/vitehub/packages/kv/src/runtime/storage.ts:98). `increment`/`getAndDelete` check driver capabilities here; no portable lock is assumed. |
| V4 | `blob.put`, `serve`, `handleUpload`, `handleMultipartUpload`, `sign`; `ensureBlob` size/type checks | [storage.ts:154](/home/maxi/vitehub/vitehub/packages/blob/src/runtime/storage.ts:154), [types.ts:171](/home/maxi/vitehub/vitehub/packages/blob/src/types.ts:171), [ensure.ts:24](/home/maxi/vitehub/vitehub/packages/blob/src/ensure.ts:24), [server-api.md:237](/home/maxi/vitehub/vitehub/docs/content/docs/blob/server-api.md:237). Signature-sniffing limitations at the same doc's line 22; R2 signing credentials at line 259. |
| V5 | `defineSchedule`, static/provider wake integration, runtime schedules | [definition.ts:27](/home/maxi/vitehub/vitehub/packages/schedule/src/definition.ts:27), [hosts.md:18](/home/maxi/vitehub/vitehub/docs/content/docs/schedule/hosts.md:18), [hosts.md:51](/home/maxi/vitehub/vitehub/docs/content/docs/schedule/hosts.md:51). Definitions, persistence and wake drivers are separate concerns. |
| V6 | ViteHub `cache` integration and preset-specific backend selection | [index.ts:275](/home/maxi/vitehub/vitehub/packages/vite-hub/src/index.ts:275), [cache.ts:35](/home/maxi/vitehub/vitehub/packages/vite-hub/src/cache.ts:35). Also read migration guide lines 221-239. This verifies the inspected implementation, not compatibility with every later Nitro cache revision. |
| V7 | Official NuxtHub migration contract: KV/Blob tuples, Database conversion, separate migration ledgers, D1 baseline | [migrate-from-nuxthub.md:19](/home/maxi/vitehub/vitehub/docs/content/docs/frameworks-hosts/migrate-from-nuxthub.md:19), [same guide:158](/home/maxi/vitehub/vitehub/docs/content/docs/frameworks-hosts/migrate-from-nuxthub.md:158), [same guide:180](/home/maxi/vitehub/vitehub/docs/content/docs/frameworks-hosts/migrate-from-nuxthub.md:180). SQLite only; this guide explicitly does not offer a PostgreSQL/MySQL conversion API. |
| V8 | `defineQueue`, `runQueue`, provider-specific enqueue options including `idempotencyKey` | [index.ts:2](/home/maxi/vitehub/vitehub/packages/queue/src/index.ts:2), [index.ts:13](/home/maxi/vitehub/vitehub/packages/queue/src/index.ts:13), [client.ts:141](/home/maxi/vitehub/vitehub/packages/queue/src/runtime/client.ts:141), [types.ts:65](/home/maxi/vitehub/vitehub/packages/queue/src/types.ts:65), [types.ts:150](/home/maxi/vitehub/vitehub/packages/queue/src/types.ts:150). Option presence does not prove identical provider guarantees. |
| V9 | `defineWorkflow`, `runWorkflow`, `getWorkflowRun`, provider-dependent steps/native workflow support | [definition.ts:4](/home/maxi/vitehub/vitehub/packages/workflow/src/definition.ts:4), [index.ts:11](/home/maxi/vitehub/vitehub/packages/workflow/src/index.ts:11), [types.ts:119](/home/maxi/vitehub/vitehub/packages/workflow/src/types.ts:119), [README.md:164](/home/maxi/vitehub/vitehub/packages/workflow/README.md:164), [README.md:218](/home/maxi/vitehub/vitehub/packages/workflow/README.md:218). A single generic durable-step API was not assumed. |
| V10 | `defineWorkspace`, `useWorkspace`, read/write access, session commit/close contracts | [index.ts:1](/home/maxi/vitehub/vitehub/packages/workspace/src/index.ts:1), [index.ts:48](/home/maxi/vitehub/vitehub/packages/workspace/src/index.ts:48), [server-api.md:28](/home/maxi/vitehub/vitehub/docs/content/docs/workspace/server-api.md:28), [server-api.md:147](/home/maxi/vitehub/vitehub/docs/content/docs/workspace/server-api.md:147). No obsolete global reset is presented as a current public API. |

### Primary sources read

- P1: Local `AGENTS.md`, `README.md`, `research/plan-v2.md`, `research/findings-v6.md`, `research/vitehub-primitives-audit.md`, and `tasks/meetups/PROMPT.md`. The audit is dated 2026-11-07 and contains stale claims; source inspection supersedes it. [Current plan](/home/maxi/vitehub/nuxt-evals/research/plan-v2.md), [latest findings](/home/maxi/vitehub/nuxt-evals/research/findings-v6.md).
- F1: Existing reference source, especially [session helper](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/utils/session.ts:5), [SSR auth state](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/app/composables/useAuth.ts:16), [startup plugin](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/app/plugins/session.ts:2), [RSVP route](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/api/events/[slug]/rsvp.post.ts:18), [confirmation queue](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/queues/rsvp-confirmation.ts:1), and [rates cache](/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference/server/api/rates.get.ts:1).
- N1: Nuxt `useAsyncData` docs, source snapshot `2c5d147050d71eab1ad55a86ad34b94be0a4eb08`, full file read through GitHub. [Source](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/4.api/2.composables/use-async-data.md). Signal propagation, truthy handler result, shallow default and shared-key consistency were checked.
- N2: Same Nuxt snapshot, [useFetch source](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/4.api/2.composables/use-fetch.md). Current docs say auto-generated keys include call-site identity; do not repeat the older blanket claim that equal URLs/options always share state across different components.
- N3: Same Nuxt snapshot, [data-fetching guide](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/12.data-fetching.md), especially setup double fetching and request-header forwarding.
- N4: Same Nuxt snapshot, [state-management guide](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/13.state-management.md), especially the explicit warning against module-level refs.
- N5: Same Nuxt snapshot, [upgrade guide](https://github.com/nuxt/nuxt/blob/2c5d147050d71eab1ad55a86ad34b94be0a4eb08/docs/1.getting-started/20.upgrade.md). Relevant sections were read for config loading, server imports, aliases, auto-import defaults, and Nitro legacy compatibility. These are current-main docs, not guaranteed behavior of the earlier reference nightly.
- U1: Vue watcher docs, snapshot `40aa88af0094f7bab4aaf786e55c748a6a251d88`, [source](https://github.com/vuejs/docs/blob/40aa88af0094f7bab4aaf786e55c748a6a251d88/src/guide/essentials/watchers.md), async dependency tracking, cleanup and synchronous scope ownership.
- H1: h3 migration guide, snapshot `2f29b875617e8daf39d25118f7474fd4c24fbfe1`, [source](https://github.com/h3js/h3/blob/2f29b875617e8daf39d25118f7474fd4c24fbfe1/MIGRATION.md), full file read. It describes explicit response returns, exact middleware path matching, native bodies/headers and Node-only access.
- H2: [h3js/h3#1241](https://github.com/h3js/h3/issues/1241), body-reuse request, full issue body read. Closed issue state does not establish which behavior the fixture's h3 utility implements.
- T1: Nitro migration guide, snapshot `0f2a7f492ab89e3f56a4fd26eee40976074aa012`, [source](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/99.migration.md), imports, scanning, cache backend and h3 transition sections.
- T2: Same Nitro snapshot, [cache docs](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/7.cache.md), cache input narrowing, response privacy, backend and edge refresh lifetime.
- T3: Same Nitro snapshot, [tasks docs](https://github.com/nitrojs/nitro/blob/0f2a7f492ab89e3f56a4fd26eee40976074aa012/docs/1.docs/50.tasks.md), task scanning, experimental flag, scheduling and host support.
- BA1: [better-auth/better-auth#11501](https://github.com/better-auth/better-auth/issues/11501), full body read. Proposed invalidation helper names in that issue are requests, not verified implemented APIs.
- D1: [drizzle-team/drizzle-orm#4938](https://github.com/drizzle-team/drizzle-orm/issues/4938), full reported SQLite/D1 cascade-loss reproduction read. This is a reporter's claim independently supported by the local site repair, not a reproduced benchmark result.
- NH1: [nuxt-hub/core#861](https://github.com/nuxt-hub/core/issues/861), deployment/migration separation report, issue body read. Not generalized to every NuxtHub release.
- R1: ViteHub commit `79f6b657955583ebfad52abc59a2f12129474b5b`, [commit](https://github.com/vite-hub/vitehub/commit/79f6b657955583ebfad52abc59a2f12129474b5b), cache encoding and regression test diff read locally.
- R2: nuxt-evals commit `6b37d2d68d448e17c81a32f958064bcc2288067d`, commit message and actual additive auth migration read locally. [Migration](/home/maxi/vitehub/nuxt-evals/site/server/databases/default/migrations/20261112195329_auth_organizations/migration.sql:1). Its message says the change was tested on a production D1 export; I did not repeat that test.
- R3: Drop commit `f949cdb7645b6b0af48c6cd62ab34206971b3abf`, auth/database patches and app config diff read locally. Real changes include lazy auth, scope/context preservation, D1 request bookmarks/read replicas and DB query instrumentation. Checked at `/home/maxi/vitehub/drop` with `git show`.
- R4: email-labeller commit `5f3d3542b664656ea1c7e3b4a446746e587a0eeb`, full cursor/watch diff read locally at `/home/maxi/vitehub/email-labeller`.
- R5: email-labeller commit `6efc348851fa21894f9e2cce3db46fc89e3edb08`, relevant sync, Gmail, health and schedule diff read locally. Commit `0f85f61adb5f5d8d4c922d53df6d28232320dfd6` was also read; it adds schedule error handling and checks watch authentication configuration.
- R6: Console commit `15b8ad9183fa44348d1f39a80b90582ebcb17cc2`, full two-line relocation diff read at `/home/maxi/vitehub/console`. It shows a historical lifecycle fix, not proof that global reset is the right current design.
- R7: Calories commit `075a9f1a2feb88e05e3a69ed2444e544d014950f`, workspace override and real SSR slot-render regression test diff read at `/home/maxi/vitehub/calories`.

History searches also covered babysitter, strata, joxi, nuxt-agent and bitacora-agent. I did not promote their commit titles alone into proven root causes. In particular, Bitacora `e6d7b71` says concurrent writes were rebased but its inspected app diff is a dependency upgrade, insufficient by itself to specify the underlying algorithm.

Before any case enters the executable suite, freeze source and target lockfiles, the bug patch, clean/fixed controls, source citations, runtime/provider assumptions, hidden checks, severity and the solution-family rubric. Verify each in three independent clean runs as required by the existing plan [P1](/home/maxi/vitehub/nuxt-evals/research/plan-v2.md). Preserve the research source independently of skills under test. None of those admission checks has been run for this proposal.
