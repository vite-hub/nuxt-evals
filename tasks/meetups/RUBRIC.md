# Meetups rubric

How we grade a Meetups app built from [PROMPT.md](PROMPT.md). Each check under a section passes, fails, or does not apply (n/a), and each section gets a score from 0 to 10.

Rules for graders:

- Grade outcomes and code. Never grade file layout for its own sake, and accept every correct form of a primitive: `useAsyncData` instead of `useFetch`, plain HTML instead of Nuxt UI, the `vite-hub/*` subpaths or the `@vite-hub/*` owner packages.
- The prompt asks for Nuxt nightly and ViteHub. Only the ViteHub sections (20 to 25) grade whether and how the app uses ViteHub. The other sections grade the behavior and the code whatever library provides it, so an app that wires its own database or auth loses points in the ViteHub sections, not twice.
- Grade against the prompt the agent got (its `PROMPT.md`). A check about a feature that prompt doesn't ask for is n/a.
- Passkeys need a domain: browse the app at `http://localhost:<port>`, never `127.0.0.1`, which WebAuthn refuses. Playwright's virtual authenticator: open a CDP session on the page, send `WebAuthn.enable`, then `WebAuthn.addVirtualAuthenticator` with `{ options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true } }`.
- Mechanical mistakes (`process.env` in server code, hand-imported auto-imports, deep relative imports, a top-level `$fetch`, `window` during setup) are Vite Doctor's to find, not the rubric's.
- Browser checks against a production build need the site URL setting (if the app has one) to match the browser's origin, or to be unset.
- Each check names how to verify it: **run** (start the built app and test it), **read** (read the code), or **both**.
- **M** marks a major check, **m** a minor one.
- Sources are Nuxt, Vue, Nitro, h3, VueUse, ViteHub ([vitehub.dev](https://vitehub.dev/llms.txt)) and web platform docs. Checks that came from replies to [Maxi's question on X](https://x.com/_onmax/status/2119005553775030726) say so with the replier's handle.

## Scores

A section scores the weighted share of its checks that pass, times 10, with one decimal: a major check weighs 3 and a minor one 1. A check marked n/a counts as a pass. A check that can't be verified in the grading setup (a production-only behavior, a third-party key we don't have) is marked **unverified**: it is reported, but it is neither a pass nor a fail, and the section is scored on the rest. Library defaults count when they are on in production (Better Auth's sign-in rate limit, for example). A section whose checks are all n/a is left out.

The headline score, 0 to 10, is a weighted mean. The general sections share 65% equally, the ViteHub sections (titles that start with "ViteHub") share 25%, and Vite Doctor's score shares 10%. A part with nothing to score drops out and the others fill its share. A run that doesn't build or start scores 0.
---

## 1. Product: the features work

Run each against the built app (`nuxt build` then `node .output/server/index.mjs`) with a fresh database.

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | A clean clone installs, migrates, builds and starts with the commands in its README or package scripts. (A grading setup that forbids installs marks the install step unverified. Check migrations against a temporary `DATABASE_URL`, or by applying the generated SQL to a fresh database, with no dev server running on the same folder.) | run | M |
| P2 | A visitor can create an account with email and password, sign out, and sign in again. | run | M |
| P3 | Sessions survive a server restart (stored in the database or a signed cookie, not in process memory). | run | M |
| P4 | The home page lists upcoming events in start order, and past events are not in it. | run | M |
| P5 | Search finds events by title. With an event titled "100% Vue", searching for `%` finds it and not every event. | run | m |
| P6 | A city filter narrows the list. | run | M |
| P7 | The list is paginated (or loads more) and doesn't send every event at once. | run | M |
| P8 | Search, city and page live in the URL. Each committed filter change adds a history entry (typing is debounced, not one entry per key), so reload and Back restore the previous filters. | run | M |
| P9 | An event page shows title, description, venue, city, start time, price, seats left and organizer name. | run | M |
| P10 | A signed-in visitor can RSVP and cancel the RSVP. A signed-out visitor is asked to sign in, then comes back to the event. | run | M |
| P11 | RSVP stops when the event is full, both in the UI and on the server. | run | M |
| P12 | Ten parallel RSVPs from ten users for an event with two seats give exactly two seats. (Create the ten users from distinct client addresses or spread out, so the app's own sign-up limit doesn't get in the way.) | run | M |
| P13 | Double- and triple-clicking "RSVP" in the browser against the local production build (no added latency), or RSVPing from two tabs, leaves exactly one RSVP and the visitor still going. | run | M |
| P14 | Seats left updates on an open event page without reload when someone else RSVPs (within ~10 s). | run | M |
| P15 | A confirmation email is sent (or captured by a dev outbox) on RSVP, and the RSVP response does not wait for it. | both | M |
| P16 | Prices show in USD, GBP or EUR. The first visit picks from the browser language; a picker changes it; the choice is remembered. | run | M |
| P17 | Signed-in users can create an event and edit their own events. | run | M |
| P18 | The organizer sees an attendee list and a chart of RSVPs over time. | run | M |
| P19 | The organizer can download the attendee list as CSV. | run | M |
| P20 | `/e/<id>` redirects to the event's current address with a permanent redirect (301 or 308). | run | M |
| P25 | A signed-in user can add a passkey, sign out, and sign in again with only the passkey. Their account page lists their passkeys and can remove one. (Browse at `localhost` with Playwright's virtual authenticator; see the rules above.) | run | M |
| P26 | An organizer can add a cover photo to an event, replace it, and remove it. It shows on the event page and in the list. A file that isn't an image, or a photo over the app's stated limit, is refused with a message that says why. | run | M |
| P27 | Attendees get a reminder email about a day before the event. In `nuxt dev` on a spare port, where mail lands in ViteHub's dev outbox (`vitehub email outbox list`), RSVP to an event that starts in about 23 hours and run the reminder job the way the README says (or `vitehub schedule run <name>`): the attendee gets one reminder, a second run sends none, and an RSVP cancelled before the run gets none. If the dev server can't run beside the graders' server, read the code. | both | M |
| P28 | After cancelling, the same visitor can RSVP again while seats are left. | run | M |
| P22 | Dark mode works and follows the system setting by default. | run | M |
| P23 | The app has demo data, a seed command, or useful empty states on a fresh database. | run | m |
## 2. Data fetching

Sources: [Data fetching](https://nuxt.com/docs/getting-started/data-fetching), [useFetch](https://nuxt.com/docs/api/composables/use-fetch), [useAsyncData](https://nuxt.com/docs/api/composables/use-async-data).

| ID | Check | How | |
| --- | --- | --- | --- |
| D2 | The browser makes no second request for data the server already rendered (check the network tab on a hard load). | run | M |
| D3 | `$fetch` is used for event-driven calls (submit, click, polling). | read | m |
| D4 | Parameterized fetches use a reactive URL getter or reactive `query`, not a fixed string plus a `watch`. | read | M |
| D5 | The search box doesn't fire a request per key press (debounce or submit). | run | M |
| D8 | Data shared app-wide (session, rates) loads once per request, not once per component. | read | m |
| D9 | Responses carry only what the page uses (no full user rows, no password hashes, no emails of other people). | read | M |
| D10 | Fetch errors become a page error (`createError`/`showError`) or an inline message. A missing event never renders an empty page. | both | M |
| D11 | Server-side calls to the app's own API forward the visitor's cookie when they need the session (`useFetch`, `useRequestFetch`, `useRequestHeaders`). | read | M |
| D12 | `server: false` or `lazy` is used only where the data isn't needed for the first HTML. | read | m |
| D13 | Personal data is cleared from the client cache on sign-out (`clearNuxtData`, `refreshNuxtData`, or a reload). | read | m |
| D14 | When the search, city or page changes quickly, a slow earlier response never replaces a newer one: one `useFetch` or `useAsyncData` whose reactive inputs cancel the request in flight, or an abort. Keys that change with every filter, so old requests keep running and land late, fail. [@CharlesYuDefine] | both | m |
## 3. State

Sources: [State management](https://nuxt.com/docs/getting-started/state-management), [useState](https://nuxt.com/docs/api/composables/use-state), [useCookie](https://nuxt.com/docs/api/composables/use-cookie), [callOnce](https://nuxt.com/docs/api/utils/call-once).

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | Shared state that must survive SSR (signed-in user, locale) uses `useState` or a store that serializes into the payload, not a module-level `ref`. [@NathanCai193129] | read | M |
| S2 | No module-level mutable state on the server that leaks between requests or users. | read | m |
| S3 | Preferences the server must render, such as the currency, live in a cookie, not `localStorage`. Color mode may use `localStorage` with a script that runs before paint; H7 grades the flash. | read | M |
| S4 | One-time bootstrap (fetch the session) uses `callOnce`, a plugin, or middleware, and runs before route middleware needs it. | read | M |
| S7 | Cookie options are deliberate: `sameSite`, `maxAge`, and `httpOnly`/`secure` for session cookies. | read | m |
| S8 | The URL is the state for filters (see P8); no duplicate filter state that falls out of sync with the URL. | read | m |
| S9 | The header changes at once after sign-in and sign-out. Sign-in updates without a full reload; sign-out may reload on purpose to drop personal data (see D13). | run | m |

## 4. SSR and hydration

Sources: [Hydration best practices](https://nuxt.com/docs/guide/best-practices/hydration), [NuxtTime](https://nuxt.com/docs/api/components/nuxt-time), [ClientOnly](https://nuxt.com/docs/api/components/client-only).

| ID | Check | How | |
| --- | --- | --- | --- |
| H1 | The event list, event page, header user and prices are in the first HTML (curl with and without a session cookie). | run | M |
| H2 | No hydration mismatch warnings in the browser console on the home, event, dashboard and sign-in pages, in a time zone and locale different from the server's. [@Joshua_WD, @li93196397] | run | M |
| H4 | Times render in the visitor's time zone without a mismatch (`NuxtTime`, a client-only formatter, or a time zone cookie). [@kyledotai] | both | M |
| H5 | `Date.now()`, `Math.random()`, or the server's time zone don't decide what a component renders on first paint. A value computed on the server and carried in the payload (an `started` flag from the API) is fine. | read | m |
| H6 | Signed-in users don't see a flash of the signed-out header on load. | run | M |
| H7 | Dark mode doesn't flash the light theme on load. | run | M |
| H8 | Prices don't flash from one currency to another on load. | run | M |
| H10 | Timers and listeners start in `onMounted` or client-only code and stop on unmount. | read | m |
| H11 | No runtime console errors in normal flows, signing out from a page with data (event, dashboard, edit) included. [@li93196397] | run | M |

## 5. Server routes, Nitro and h3

Sources: [Server directory](https://nuxt.com/docs/guide/directory-structure/server), [h3 utils](https://h3.dev/utils), Nuxt 5 `nuxt/server` exports.

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | Request bodies are validated with `readValidatedBody` (or equal) and a schema. In Nuxt 5, `readValidatedBody(event, schema)` takes a Standard Schema (Zod, Valibot) directly and returns field issues. [@_onmax, @BoboLinNotes] | read | M |
| R2 | Query strings are validated with `getValidatedQuery` (or equal). | read | M |
| R3 | Route params are read with `getRouterParam` and validated or looked up safely. | read | m |
| R4 | Invalid input returns 400 or 422 with field messages, never 500. | run | M |
| R5 | Errors use `createError` with a correct status: 401 signed out, 403 or 404 for someone else's resource, 404 missing, 409 full or conflicting (422 also fits a refused edit, like cutting seats below the number going). | both | M |
| R7 | Route files export only the handler; shared logic lives in `server/utils` or similar. | read | m |
| R8 | Handlers return plain JSON-safe data; dates are ISO strings on the wire and the client types match. | read | m |
| R9 | In Nuxt 5 (server auto-imports off), server files import what they use from `nuxt/server`, `h3`, `nitro/*`, or the module, and nothing is imported that doesn't exist. [@silvesterwali] | read | M |
| R12 | Slow side effects (mail) run after the response (a queue job, `event.waitUntil`, a background task), and their failure doesn't fail the RSVP. | read | M |
| R13 | The redirect for old links is a server route or route rule with a 301/308, not a client-side `navigateTo` after render. | read | M |
| R14 | Responses that depend on the user are not cached by a shared cache (no `cachedEventHandler` or `swr` route rule whose key leaves out the user). [@CharlesYuDefine] | read | m |
| R15 | The CSV response sets `content-type: text/csv` and `content-disposition: attachment`. | run | m |
| R16 | The server doesn't rebuild what h3 or Nitro already provide (cookie parsing, body parsing, redirects, caching). [@leopoldk] | read | m |

## 6. Database

| ID | Check | How | |
| --- | --- | --- | --- |
| B1 | A real database (SQLite, libSQL, Postgres, D1...), not JSON files or memory. | read | M |
| B2 | The schema lives in code with migrations that can be applied to a fresh database. | read | M |
| B3 | Times are stored as UTC instants (timestamp or integer ms), with the event's IANA time zone stored next to them if the app shows venue time. [@kyledotai] | read | M |
| B4 | Money is stored as integer minor units (cents), not floats. | read | m |
| B5 | A unique constraint on (event, user) prevents duplicate RSVPs. | read | m |
| B6 | Capacity can't be exceeded under concurrency, also while the organizer lowers the seats: a single conditional statement that reads the current capacity, a transaction with a lock, or a constraint (see P12). | both | M |
| B7 | Foreign keys connect events to organizers and RSVPs to events and users, with a delete rule. | read | m |
| B8 | Indexes cover the list query (start time, city) and lookups (slug, organizer). | read | m |
| B9 | Slugs (or the public address) are unique and enforced by the database. | read | m |
| B10 | No N+1 queries on the list or dashboard (seat counts come from a join, subquery or counter, not one query per event). | read | M |
| B11 | Pagination happens in SQL (`LIMIT`/`OFFSET` or keyset), not by loading all rows. | read | M |
| B12 | Search escapes `LIKE` wildcards or uses full-text search with bound parameters. No string-built SQL from user input. | read | M |
| B13 | Lowering capacity below the number of people going is refused, without a race. | both | m |
| B14 | A seed or fixture path fills demo data without bypassing the app's own rules (passwords hashed through the auth library). | read | m |

## 7. Auth and authorization

| ID | Check | How | |
| --- | --- | --- | --- |
| A1 | Passwords are hashed by a vetted library (Better Auth, Lucia, nuxt-auth-utils...), never stored or compared in plain text. | read | M |
| A2 | Session cookies are `httpOnly`, `sameSite=lax` or stricter, and `secure` in production. Verify behind HTTPS: sign in with `X-Forwarded-Proto: https` and a matching `Origin`/`Host` (with the app's documented production settings), and expect success and a `Secure` cookie. | run | M |
| A3 | Every write route checks the session on the server. Client middleware alone is not protection. | both | M |
| A4 | Organizer-only routes (edit, attendees, CSV) check that the user organizes that event. Another signed-in user gets 403 or 404. | run | M |
| A5 | The dashboard and edit pages redirect signed-out visitors to sign-in and back. | run | m |
| A6 | The post-sign-in redirect only accepts same-site paths (no open redirect via `?redirect=https://evil`). | both | M |
| A7 | Sign-in and RSVP are rate limited per client or per account, not in one shared bucket: after a burst of failed sign-ins from client A, client B can still sign in, and client A can't escape the limit by sending its own `X-Forwarded-For`. Fixed-window limiters can let a burst through across a window boundary: repeat with a fresh client, or accept a 429 within twice the limit. | run | m |
| A8 | Attendee emails are visible only to the organizer, never in public APIs or page payloads. | run | M |
| A10 | Sign-out ends the session on the server, not only on the client. | run | m |
| A11 | Auth state on the server is read per request (from headers or the event), not cached in a module. | read | M |

## 8. Validation

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The event form and the create/update routes use one schema (in `shared/` or imported by both). | read | M |
| V2 | Every form (event, sign-up, sign-in) shows field errors next to fields before submit, in the app's own words for every rule, limits and ranges included (not library defaults like "expected string, received undefined" or "Too big: expected string to have <=120 characters"), and the server repeats every rule. Limits the auth library enforces (a maximum password length, for example) count as rules the form must show; where the auth library itself is the server check (sign-in), its refusal counts as the server repeating the rule. | both | M |
| V3 | Text fields are trimmed and length-limited; numbers are integers with a range. Passwords are never trimmed. | read | m |
| V4 | The time zone is validated against IANA names, and the start can't be a date or time that doesn't exist at the venue (Feb 31, 02:30 on the night clocks jump forward). | both | M |
| V5 | The page and the API read the list filters with the same rules (one shared schema or parser). A bad value in the page's URL (`?page=abc`, `?page=99999`, an unknown city) shows the list with a default, never an error page; the API may answer 400 to a direct request. | both | m |
| V6 | Server error messages reach the user (toast or inline), not a generic "Error". | run | m |
| V7 | A new event can't start in the past (an existing past event can still be edited). | run | m |

| V8 | The cover upload checks the file type and size in the browser before sending, and shows the server's refusal next to the field. | run | m |
## 9. Caching and performance

Sources: [Nitro cache](https://nitro.build/guide/cache), [Route rules](https://nuxt.com/docs/guide/concepts/rendering#route-rules).

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | The exchange-rate call is cached on the server and shared by all visitors (`defineCachedFunction`, `cachedEventHandler`, KV, or a route rule), with a timeout. | read | M |
| C2 | A failed or slow rates service doesn't break the page; prices fall back to euros or a clear message. Test with a rates URL that never answers, on a cold cache: pages still answer in under 3 s. | both | M |
| C3 | Live seats stop polling (or close the stream) when the page is hidden or left. | run | M |
| C4 | Live seats use a small endpoint or stream, not a refetch of the whole event or list. | read | m |
| C5 | API responses and the page payload don't include fields the page doesn't render. | read | m |
| C7 | Cover photos have a width and height (no layout shift), load lazily below the fold, and a card asks for a copy sized for the card, not the full upload. | both | m |
| C8 | Public, user-independent data (city list) is cached; user-dependent data is not. | read | m |

## 10. Time and money

| ID | Check | How | |
| --- | --- | --- | --- |
| T1 | The organizer enters the start in venue time with a time zone, and the stored instant is right across daylight-saving changes. A time that happens twice may map to either instant; a time that doesn't exist is refused or moved by a documented rule. [@kyledotai] | both | M |
| T2 | Visitors see start times in their own time zone; the event page also shows the venue's local time. | run | M |
| T3 | Relative times ("in 3 days") use `NuxtTime relative`, `useTimeAgo`, or `Intl.RelativeTimeFormat`, not hand-rolled strings. | read | m |
| T5 | Conversion uses rates from a real source and rounds only for display. | read | m |
| T7 | Editing an event shows the stored start in venue time, unchanged. | run | m |

## 11. SEO and head

Sources: [SEO and meta](https://nuxt.com/docs/getting-started/seo-meta), [useSeoMeta](https://nuxt.com/docs/api/composables/use-seo-meta).

| ID | Check | How | |
| --- | --- | --- | --- |
| E1 | Each page has a title and description (`useSeoMeta`/`useHead`), with a title template. | run | M |
| E2 | Event pages have Open Graph title, description and URL. | run | M |
| E3 | Event pages have one canonical URL without query strings. | run | m |
| E4 | A missing event returns HTTP 404 with a real not-found page, not 200. | run | M |
| E5 | Private pages (dashboard, edit, sign-in) are `noindex` or not linked for crawlers. | run | m |
| E6 | `<html lang>` is set. | run | m |
| E7 | Links are real `<a href>` (`NuxtLink`), including pagination. | run | m |

| E8 | An event page with a cover photo gives it as an absolute `og:image` URL. | run | m |
## 12. Security

| ID | Check | How | |
| --- | --- | --- | --- |
| X1 | Secrets (auth secret, mail key, rates key) are server-only `runtimeConfig` or env, never `public` and never in the client bundle. | both | m |
| X2 | No `v-html` with user content. | read | m |
| X3 | CSV export defuses formula injection (`=`, `+`, `-`, `@` prefixes) and quotes fields. | both | m |
| X4 | Mutating routes are protected against cross-site requests (same-site cookies, origin check, or the auth library's CSRF handling). | read | M |
| X7 | Dependencies are pinned or locked; no unused packages with install scripts. | read | m |
| X8 | Writes copy only the fields the route allows from the validated body. No route spreads the body into an insert or update, so a request can't set `organizerId`, `id`, or the seat counts. [@CharlesYuDefine] | both | M |

| X9 | Uploads can't put script on the app's origin: only raster image types are stored (no SVG, HTML or a renamed file whose bytes aren't an image), and files are served with their stored image type and `X-Content-Type-Options: nosniff`, or from another origin. | both | M |
| X10 | Only the event's organizer can upload, replace or remove its cover; another signed-in user gets 403 or 404. | run | M |
## 13. UI and theming

Sources: [Nuxt UI theme](https://ui.nuxt.com/docs/getting-started/theme), [Nuxt UI components](https://ui.nuxt.com/docs/components). Nuxt UI is not required. If it is used, its checks apply.

| ID | Check | How | |
| --- | --- | --- | --- |
| U1 | The brand color is set once as a theme token (Nuxt UI `app.config` + `@theme`, Tailwind theme, or CSS variables), not repeated as hex values in components. [@lucpotage] | read | M |
| U2 | Radius, spacing and color come from tokens, so a button and a dropdown match. [@lucpotage] | read | m |
| U3 | Text and buttons meet WCAG AA contrast in light and dark mode, including hover states, placeholders, form errors, alerts and status badges (#00DC82 on white is 1.8:1; Nuxt UI's default 500 shades for error and success fail on white too). | run | M |
| U4 | If Nuxt UI is used: props, slots and events match the installed version (no content in the wrong slot, no unknown props). Typecheck passes. [@CharlesYuDefine] | read | m |
| U6 | If a component library is installed, the app uses it instead of hand-building the same control. [@leopoldk, @NyllRe] | read | m |
| U7 | Loading states: buttons show progress, and a triple click on create, edit or RSVP sends one request; lists show a pending state. | run | m |
| U8 | Empty states for no results, no events, no attendees. | run | m |
| U9 | The layout works at 390 px wide without horizontal scroll. | run | m |
| U10 | Toasts or inline messages confirm RSVP, cancel, save and errors. | run | m |
| U11 | After a failed submit, fixing the field and clicking submit once sends the request (no click lost to an error message disappearing on blur). A first click that only reveals a blur error before any submit is not a failure. | run | m |

## 14. Vue and reactivity

Sources: [Vue reactivity](https://vuejs.org/guide/essentials/reactivity-fundamentals.html), [Computed](https://vuejs.org/guide/essentials/computed.html), [Watchers](https://vuejs.org/guide/essentials/watchers.html), [VueUse](https://vueuse.org).

| ID | Check | How | |
| --- | --- | --- | --- |
| Q2 | No `computed` for constant values, and none that returns a ref, prop or store value unchanged. [@leopoldk] | read | m |
| Q3 | No `onMounted` + `$fetch` for data that SSR could load. [@li93196397] | read | M |
| Q5 | Composables hold cohesive, reusable or stateful logic, not every small interaction. A single-use composable is fine when it groups one concern. [@weareupclose] | read | m |
| Q7 | No mutation of props or of `useFetch` data in place. | read | M |
| Q8 | `v-for` has stable keys (ids or slugs, not indexes). | read | m |
| Q11 | Every `watch` and `watchEffect` does a side effect that a `computed`, a reactive `useFetch` input, an event handler or `v-model` can't do. List each watcher in the evidence with what it does. [@li93196397] | read | m |

## 15. File organization and conventions

Sources: [Directory structure](https://nuxt.com/docs/guide/directory-structure), [shared/](https://nuxt.com/docs/guide/directory-structure/shared).

| ID | Check | How | |
| --- | --- | --- | --- |
| F2 | Pages use file routing with dynamic params (`events/[slug]`), not one page that switches on a param. | read | m |
| F3 | Page access checks use route middleware (`app/middleware` with `definePageMeta`, or an equivalent global or inline middleware), not checks scattered in page setup. | read | m |
| F5 | Server helpers live in `server/utils` (or a named folder) and route files stay thin. | read | m |
| F6 | Each component and module has one clear job; no 400-line page with everything inline. A small single-use component is fine when it names a concern. | read | m |
| F8 | No dead code, commented-out code, unused files or unused dependencies. | read | m |
| F9 | Config lives in `nuxt.config.ts` and `app.config.ts`, not scattered in components. | read | m |
| F10 | Generated folders (`.nuxt`, `.output`, local database files, `.env`) are gitignored. | read | m |

## 16. TypeScript

| ID | Check | How | |
| --- | --- | --- | --- |
| Y1 | `nuxt typecheck` (or `vue-tsc --noEmit` on the generated tsconfigs) passes in the app folder after the documented install and production build. An error only in a file ViteHub generates under `.vitehub/` is a ViteHub bug: name it in the evidence and don't fail the app for it (on a fresh clone, `.vitehub/auth/route.ts` fails until a build writes `.vitehub/types/auth-server.d.ts`). | run | m |
| Y2 | No `any`, `as any`, `@ts-ignore` or `@ts-expect-error` without a reason in a comment. | read | M |
| Y3 | `$fetch`/`useFetch` results are inferred from the server routes, not re-declared by hand with `<T>`. | read | m |
| Y4 | Schema types are inferred (`z.infer`, Drizzle `$inferSelect`), not duplicated. | read | m |
| Y5 | Non-null assertions (`!`) only where the code just proved the value exists. | read | m |

## 17. Accessibility

| ID | Check | How | |
| --- | --- | --- | --- |
| W1 | Every input has a visible label tied to it. A compact header control whose value says what it is (a currency picker showing "USD") may use `aria-label` instead. | run | M |
| W2 | Everything works with the keyboard, with a visible focus ring (a library's default ring counts when it is visible on the control in both color modes; a ring the app adds itself needs 3:1 against the page). | run | M |
| W3 | The seats-left count is announced to screen readers when it changes (`aria-live`). | read | m |
| W4 | Icon-only buttons have an accessible name. | run | m |
| W5 | The chart has a text alternative. | read | m |
| W6 | Headings form an order (one `h1` per page). | run | m |
| W7 | Error and success messages are announced (toasts with role, or inline text near the field). | run | m |

| W8 | Cover photos have alt text, or an empty `alt` where the title next to them already names the event. | read | m |
## 18. Error handling and resilience

| ID | Check | How | |
| --- | --- | --- | --- |
| G1 | `app/error.vue` exists, uses the app layout, and offers a way back (`clearError`). | run | M |
| G2 | A failed RSVP (full, signed out, network) shows a clear message and the seat count refreshes. | run | m |
| G3 | External services (rates, mail) have timeouts, and their failures are logged, not swallowed. | read | M |
| G4 | No silent `catch {}` and no fallbacks that hide a broken state. An empty catch is fine only with a comment saying why the failure is harmless (a missed poll that the next one repeats). | read | m |
| G5 | RSVP for a past event is refused on the server. | run | m |

## 19. Deployment and configuration

| ID | Check | How | |
| --- | --- | --- | --- |
| K2 | Every setting that differs per environment (database, auth secret, mail, rates) is a runtime config key or env variable, documented in the README or `.env.example`, and the documented production start loads it. | read | M |
| K3 | Migrations run as an explicit step (script or startup hook), documented. | read | M |
| K4 | No dev-only behavior in production (dev outbox, seed routes open to anyone, debug logs). | read | M |
| K5 | The README says how to run and seed, and the README or an `.env.example` it points to says how to configure mail and the rates service. | read | m |
## 20. ViteHub: setup

Sources: [ViteHub for agents](https://vitehub.dev/llms.txt), [Installation](https://vitehub.dev/raw/docs/getting-started/installation.md), [env](https://vitehub.dev/raw/docs/env/configure.md), [Rate Limit](https://vitehub.dev/raw/docs/rate-limit.md). The live docs can be newer than the pinned build; when they disagree, the installed package wins.

Notes for graders, for all the ViteHub sections: the dev outbox lives in the dev server's memory (50 messages, cleared on restart); see it with `vitehub email outbox list` while `nuxt dev` runs. Production builds have no outbox. Migrations: `vitehub db generate`, then `vitehub db migrate`; the local database is `.vitehub/data/database/sqlite.db`. A dev server generates an app secret into `.vitehub/env/secret`; a build doesn't. ViteHub's docs still say Nuxt 4 and h3 1; h3 2 under Nuxt 5 is correct.

| ID | Check | How | |
| --- | --- | --- | --- |
| I1 | The app runs on Nuxt 5 nightly (Nitro 3, h3 2) with ViteHub registered as its Nuxt module (`vite-hub/nuxt`) with a `preset`, its options in the module entry or the top-level `vitehub` key of `nuxt.config.ts` (not a `vite.config.ts` Nuxt never reads), on the pkg.pr.new build the prompt names or a newer one. Every `vite-hub` and `@vite-hub/*` package resolves to that one build, not to the npm 0.1.0 release. | read | M |
| I2 | With no third-party keys, the app installs, migrates, builds and runs on ViteHub's local drivers: a SQLite or libSQL file, mail captured or logged instead of sent, photos in the local Blob store, jobs in the local queue. | run | M |
| I3 | Every ViteHub feature the app turns on is used, and every ViteHub helper the app imports has its feature on (no `runQueue` with `queue` off). The same `vitehub` config works in `nuxt dev` and in the production build. [@CharlesYuDefine] | read | m |
| I4 | Code imports ViteHub only through its public exports (`vite-hub/*` subpaths, `@vite-hub/*` packages, the generated `#vitehub/*` aliases the docs name), never `dist/` files, internal paths, files under `.vitehub/`, or edited copies in `node_modules`. | read | m |
| I5 | Host and provider choices (database URL, mail driver, blob driver, preset) live in the `vitehub` config and the environment. Application code calls the same ViteHub helpers on every host and imports no provider SDK. | read | m |
| I6 | Limits on app actions (RSVP, uploads, creating events) use ViteHub Rate Limit (`requireRateLimit` or `checkRateLimit` before the side effect, with a fixed policy, keyed by the user id for signed-in actions), not a hand-written counter in memory, KV or the database. | read | m |
| I7 | Provider keys and secrets reach ViteHub at runtime through `env({ secret: true, source: env.source(...) })` (or Better Auth's own variables for the auth secret), with no default and no `VITE_` prefix. No secret is a literal in the code or config. | read | m |
| I8 | `.vitehub/` (generated code, local data, the dev secret in `.vitehub/env/secret`) is gitignored, not committed. | read | m |

## 21. ViteHub: Database

Sources: [Database configure](https://vitehub.dev/raw/docs/database/configure.md), [Database get started](https://vitehub.dev/raw/docs/database/get-started.md), [Database server API](https://vitehub.dev/raw/docs/database/server-api.md).

| ID | Check | How | |
| --- | --- | --- | --- |
| J1 | The database goes through ViteHub Database: the `vitehub.database` option is on ("a discovered Database Definition does not enable Database"), and queries use its Drizzle helper (`useDatabase()`, or `db`/`schema` from `vite-hub/database/drizzle`), not a database client wired by hand or a hosted service's SDK. | read | M |
| J2 | The schema lives in a Database Definition (`server/databases/`), and its migrations come from `vitehub db generate` (or drizzle-kit the way ViteHub documents it), are committed, and apply to a fresh database with one documented command (`vitehub db migrate`, or migrate on start as the docs show). | both | M |
| J3 | The app's tables refer to Auth's `user` table without declaring Better Auth's own tables again in the Definition's schema, which would create them twice or drift from what `authDatabase()` adds; a typed view kept out of `schema`, or `useDatabase().schema`, is fine. | read | m |
| J4 | The connection URL comes from the environment through `env()` with a local default (a SQLite file under `.vitehub/data` or a libSQL URL), with the auth token as a secret. No hosted database URL is a literal in the code. | read | m |

## 22. ViteHub: Auth

Sources: [Auth configure](https://vitehub.dev/raw/docs/auth/configure.md), [Auth server API](https://vitehub.dev/raw/docs/auth/server-api.md), [Better Auth passkey plugin](https://www.better-auth.com/docs/plugins/passkey).

| ID | Check | How | |
| --- | --- | --- | --- |
| L1 | Auth goes through ViteHub Auth: the `vitehub.auth` option is on, `server/auth.ts` uses `defineAuth` with `authDatabase()` so users and sessions persist (the default store is in memory), and server code reads the session per request through ViteHub's helpers (`auth.api.getSession({ headers })`, `withAuth`, `requireAuth`). No hand-built session system or hosted auth service. | read | M |
| L2 | Passkeys use Better Auth's `passkey()` plugin (`@better-auth/passkey`) in `defineAuth`'s `plugins`, with its `passkey` table in the app's Database Definition and migrations, because `authDatabase()` adds only the core tables ("Other plugins that add tables need their tables in the Database Definition"). No hand-written WebAuthn ceremony or WebAuthn library wired beside Auth. | read | M |
| L3 | The passkey relying party follows the deployment: `rpID` and `origin` come from the configured public URL or the request origin, so a deployed domain works. Better Auth's default `rpID` is `"localhost"`, which fails on any real domain. | read | M |
| L4 | The browser signs in with a passkey, adds and deletes passkeys through Better Auth's client with `passkeyClient()` (ViteHub's `createAuthClient` from `vite-hub/auth/vue`, or Better Auth's own): `signIn.passkey()`, `passkey.addPasskey()`, `passkey.deletePasskey()`. No hand-built WebAuthn requests to `/api/auth`. Reading Better Auth's GET endpoints (the session, the passkey list) with `useFetch` so they render on the server is fine. | read | m |
| L5 | Sign-in is rate limited by Better Auth's limiter (on outside dev; with `authDatabase()` its counters live in the database and it counts the address the host reports, not a client's `X-Forwarded-For`) or by ViteHub Rate Limit keyed per client. Not a hand-written counter, and not a limiter turned off without a replacement. | read | m |
| L6 | Account actions use Better Auth's endpoints (sign-out, passkey list and delete, password changes), not custom routes that write the `user`, `session`, `account` or `passkey` tables. | read | m |
| L7 | ViteHub Auth's routes answer on the production build: `GET /api/auth/get-session` returns JSON (not 404), and `POST /api/auth/sign-up/email` sets a session cookie (or the same under a documented `basePath`). | run | M |
| L8 | Runtime Better Auth values come at runtime: `baseURL` and `secret` from the Definition callback, `runtime`, or the environment, not static literals; `advanced.trustedProxyHeaders` only behind a documented proxy. | read | m |

## 23. ViteHub: Email

Sources: [Email configure](https://vitehub.dev/raw/docs/email/configure.md), [Email server API](https://vitehub.dev/raw/docs/email/server-api.md), [Email limits and errors](https://vitehub.dev/raw/docs/email/limits-and-errors.md), [Email hosts](https://vitehub.dev/raw/docs/email/hosts.md).

| ID | Check | How | |
| --- | --- | --- | --- |
| M1 | Mail goes through ViteHub Email: the `vitehub.email` option names a driver that runs on the chosen preset (`resend` on `node`; `email: true` picks Cloudflare Email), and code sends with `email.send()` from `vite-hub/email/server`, not a provider SDK or a `fetch` to a mail provider. | read | M |
| M2 | Code reads the result of `email.send()` as its `[error, sent]` tuple and acts on `error`: it logs it, and in a job it throws so the queue retries. Not only a `try`/`catch` around a call that doesn't throw for provider errors. | read | M |
| M3 | In `nuxt dev` with no mail key, a confirmation lands in ViteHub's dev outbox (`vitehub email outbox list`): the email config doesn't force `remote`. | run | m |
| M4 | User text in an HTML email is escaped: plain text, or ViteHub's `server/emails` templates with scalar `{{ data.x }}` bindings rendered by `renderEmailMarkdown()`. No HTML built by string concatenation with an event title or a user's name in it. | read | M |
| M5 | The confirmation and the reminder state the start in the venue's time with the zone named, the venue, and an absolute link to the event built from the configured public URL, not from the request's `Host` header. | read | m |
| M6 | The sender address and the provider key come from runtime config or the environment; none is a literal in code. | read | m |

## 24. ViteHub: Blob

Sources: [Blob configure](https://vitehub.dev/raw/docs/blob/configure.md), [Blob server API](https://vitehub.dev/raw/docs/blob/server-api.md), [Blob media](https://vitehub.dev/raw/docs/blob/media.md).

| ID | Check | How | |
| --- | --- | --- | --- |
| O1 | Cover photos go through ViteHub Blob: `vitehub.blob` is on, and the upload route stores the file with `blob.put()` or `blob.handleUpload()` after `ensureBlob()` (or `handleUpload`'s `ensure`) checked its size and type on the server. No writes to `public/`, the local disk or a provider SDK by hand, and no image bytes or base64 in the database. | read | M |
| O2 | Photos are served by Blob's serve route (`blob.serve` option, with `X-Content-Type-Options: nosniff` in its headers) or by `blob.serve()` in an app route, not by reading files and writing them to the response by hand. | read | m |
| O3 | Stored paths come from the server (the event id, a random suffix), not the client's file name alone, and the database keeps the Blob path, not a full URL that breaks when the host or route changes. | read | m |
| O4 | Replacing or removing a cover deletes the old object with `blob.del()`, so no orphaned files pile up. | read | m |
| O5 | Pages ask for a copy at the size they show: the serve route's variants (`?w=640`) with a transformer installed (sharp on Node, Photon, or the Cloudflare Images binding), `responsiveImage()`, or Nuxt Image with a provider. Variant URLs without a transformer serve the full original, so they don't count. | both | m |
| O6 | The upload route checks the stored bytes, not only the type the browser declared: `ensureBlob()` trusts the declared type, so the route also checks the file's signature (`detectContentType()` from `vite-hub/blob/content-type`) or decodes the image. | read | m |

## 25. ViteHub: Jobs

Sources: [Queue get started](https://vitehub.dev/raw/docs/queue/get-started.md), [Queue server API](https://vitehub.dev/raw/docs/queue/server-api.md), [Queue hosts](https://vitehub.dev/raw/docs/queue/hosts.md), [Schedule configure](https://vitehub.dev/raw/docs/schedule/configure.md), [Schedule hosts](https://vitehub.dev/raw/docs/schedule/hosts.md), [Email limits and errors](https://vitehub.dev/raw/docs/email/limits-and-errors.md).

| ID | Check | How | |
| --- | --- | --- | --- |
| N1 | The confirmation email is sent from a ViteHub Queue job (`defineQueue` in `server/queues/`, `runQueue()` from the RSVP route after the RSVP is stored), so a failed send is retried. `event.waitUntil` or a fire-and-forget promise loses the email on a provider error or a restart. | read | M |
| N2 | A retried or repeated job can't send the same email twice. ViteHub's Email docs: "a blind retry can send a duplicate. Put retry and idempotency policy in Queue". The job claims the RSVP (a sent-at column set in one conditional statement) before sending, and enqueues with an `idempotencyKey`, or an equal guard. | read | M |
| N3 | The reminder runs from a ViteHub Schedule (`defineSchedule` with a `cron` in `server/schedules/`), and the production build runs it: on the `node` preset that needs `schedule: { runtime: { driver: "process" } }` (a Node build with `schedule: true` alone fails with `VITE_HUB_R0137`) and KV for the schedule's runs. Not a `setInterval` in a plugin, and not a cron route nobody calls. | read | M |
| N4 | Each attendee gets at most one reminder per event, about a day before its start instant in UTC: the query is bounded by the indexed start time, skips RSVPs already reminded, and a run that repeats or overlaps (two ticks, a restart, a manual run) sends no duplicates. | both | M |
| N5 | The schedule queues one job per reminder (or sends in bounded batches through the queue), rather than sending every email inline in one tick with no retry. | read | m |
| N6 | Job payloads carry ids, not whole records or secrets, and handlers read the current state, so an RSVP cancelled or an event changed after the job was queued sends nothing or the new details. | read | m |
| N7 | The README says how to run the reminder job now (`vitehub schedule run <name>`, or the app's own command) and how to see queued and dead jobs. | read | m |

## 26. The agent's own verification

Read from the session log, not the code. n/a for the reference app, which has no agent session.

| ID | Check | How | |
| --- | --- | --- | --- |
| Z1 | The agent ran a production build. | log | m |
| Z2 | The agent ran the type checker. | log | m |
| Z3 | The agent exercised the app (curl, browser, or tests), not only the build. | log | M |
| Z4 | The agent checked the browser console or hydration. [@li93196397] | log | m |
| Z5 | The agent tested the concurrency rule (two seats, many requests) or wrote a test for it. | log | m |
| Z6 | The final message lists what was done, what wasn't, and how to run it, without claiming checks it didn't run. | log | m |

---

## Where the checks come from

Mistakes from the replies that a linter can find are Vite Doctor's to report (its score is 10% of the headline); the rest are checks here.

| Reply on X | Checks | Vite Doctor rules |
| --- | --- | --- |
| @CharlesYuDefine: Nuxt UI slots and props from stale memory; top-level `$fetch`; `useAsyncData` keys that keep stale requests running; the validated body spread into a DB update; `cachedEventHandler` without the user in the key; config that works in production but breaks dev | U4, D14, X8, R14, I3 | `nuxt/fetch/no-raw-fetch-in-setup` |
| @li93196397: too much `watch` and `onMounted`; doesn't check hydration or console errors | Q3, Q11, H2, H11, Z4 | `vue/reactivity/prefer-computed-over-watch-assign` |
| @weareupclose: imports auto-imported things; a composable for every interaction | Q5 | `nuxt/imports/no-explicit-auto-import` |
| @Joshua_WD: touches `window` during setup; hydration mismatches | H2 | `nuxt/hydration/no-browser-global-in-universal-code`, `nuxt/hydration/no-browser-side-effects-in-setup` |
| @leopoldk: `computed` that never recomputes; rebuilds what Nuxt, Nitro, h3 or VueUse ship | Q2, R16, U6 | `vueuse/prefer-use-timers`, `vue/lifecycle/prefer-use-event-listener` |
| @BoboLinNotes, @mayank0324, @zyeutequebec, @adarshmadrecha: `$fetch` vs `useFetch`; `process.env` instead of runtime config | D2 | `nuxt/fetch/no-raw-fetch-in-setup`, `nitro/runtime/no-process-env-in-server` |
| @silvesterwali: server auto-imports | R9 | |
| @lucpotage: relative paths instead of aliases; Nuxt UI global vs local overrides, app.config vs CSS variables | U1, U2 | `nuxt/imports/prefer-alias-over-relative-parent` |
| @NathanCai193129: `ref` instead of `useState` | S1 | |
| @kyledotai: time zones when storing and showing timestamps | B3, H4, T1, T2 | `nuxt/hydration/no-time-dependent-render-without-nuxttime-or-clientonly` |
| @NyllRe: hand-writes what Nuxt UI ships | U6 | |
| @_onmax (the question): h3 utils like `readValidatedBody` | R1, R2 | `nitro/request/prefer-validated-body`, `nitro/request/prefer-validated-query` |
