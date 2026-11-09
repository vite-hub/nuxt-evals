# Meetups v2 rubric

How we grade a Meetups app built from [PROMPT.md](PROMPT.md). Each section gets a score from 1 to 5. Each check under it passes, fails, or does not apply (n/a).

Rules for graders:

- Grade outcomes and code. Never grade file layout for its own sake, and accept every correct form of a primitive: another database, another auth library, `useAsyncData` instead of `useFetch`, plain HTML instead of Nuxt UI.
- Browser checks against a production build need the site URL setting (if the app has one) to match the browser's origin, or to be unset.
- Each check names how to verify it: **run** (start the built app and test it), **read** (read the code), or **both**.
- **M** marks a major check, **m** a minor one.
- Sources are Nuxt, Vue, Nitro, h3, VueUse and web platform docs. Checks that came from replies to [Maxi's question on X](https://x.com/_onmax/status/2119005553775030726) say so with the replier's handle.

## Section scores

| Score | Meaning |
| --- | --- |
| 5 | Every major check passes, and at most one minor check fails. |
| 4 | Every major check passes; two or three minor checks fail. |
| 3 | One major check fails, or four or more minor checks fail. It works, but a reviewer would block the merge. |
| 2 | Two or three major checks fail. |
| 1 | Four or more major checks fail, or the feature is missing or broken. |

A check marked n/a counts as a pass. A check that can't be verified in the grading setup (no session log, a production-only behavior) is marked **unverified**: it is reported, but it is neither a pass nor a fail, and the section is scored on the rest. Library defaults count when they are on in production (Better Auth's sign-in rate limit, for example). The headline score is the mean of the section scores; a section whose checks are all n/a is left out. A run that doesn't build or start scores 1 in every section.

---

## 1. Product: the features work

Run each against the built app (`nuxt build` then `node .output/server/index.mjs`) with a fresh database.

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | A clean clone installs, migrates, builds and starts with the commands in its README or package scripts. (A grading setup that forbids installs marks the install step unverified.) | run | M |
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
| P13 | Double- and triple-clicking "RSVP" in the browser against a local build (no added latency), or RSVPing from two tabs, leaves exactly one RSVP and the visitor still going. | run | M |
| P14 | Seats left updates on an open event page without reload when someone else RSVPs (within ~10 s). | run | M |
| P15 | A confirmation email is sent (or captured by a dev outbox) on RSVP, and the RSVP response does not wait for it. | both | M |
| P16 | Prices show in USD, GBP or EUR. The first visit picks from the browser language; a picker changes it; the choice is remembered. | run | M |
| P17 | Signed-in users can create an event and edit their own events. | run | M |
| P18 | The organizer sees an attendee list and a chart of RSVPs over time. | run | M |
| P19 | The organizer can download the attendee list as CSV. | run | M |
| P20 | `/e/<id>` redirects to the event's current address with a permanent redirect (301 or 308). | run | M |
| P21 | Brand green #00DC82 is visible in the UI in at least one mode. A darker shade of it where #00DC82 would fail contrast (U3) counts. | run | m |
| P22 | Dark mode works and follows the system setting by default. | run | M |
| P23 | The app has demo data, a seed command, or useful empty states on a fresh database. | run | m |
| P24 | Free events read as free, not "€0.00". | run | m |

## 2. Data fetching

Sources: [Data fetching](https://nuxt.com/docs/getting-started/data-fetching), [useFetch](https://nuxt.com/docs/api/composables/use-fetch), [useAsyncData](https://nuxt.com/docs/api/composables/use-async-data).

| ID | Check | How | |
| --- | --- | --- | --- |
| D1 | First-render data comes from `useFetch` or `useAsyncData`, never a top-level `await $fetch()` in `<script setup>`. [@BoboLinNotes, @mayank0324, @CharlesYuDefine] | read | M |
| D2 | The browser makes no second request for data the server already rendered (check the network tab on a hard load). | run | M |
| D3 | `$fetch` is used for event-driven calls (submit, click, polling). | read | m |
| D4 | Parameterized fetches use a reactive URL getter or reactive `query`, not a fixed string plus a `watch`. | read | M |
| D5 | The search box doesn't fire a request per key press (debounce or submit). | run | M |
| D6 | `useAsyncData` keys, where given, are unique per resource and include every input that changes the result. | read | m |
| D7 | Handlers passed to `useAsyncData` have no side effects (no store writes, no analytics). | read | m |
| D8 | Data shared app-wide (session, rates) loads once per request, not once per component. | read | m |
| D9 | Responses carry only what the page uses (no full user rows, no password hashes, no emails of other people). | read | M |
| D10 | Fetch errors become a page error (`createError`/`showError`) or an inline message. A missing event never renders an empty page. | both | M |
| D11 | Server-side calls to the app's own API forward the visitor's cookie when they need the session (`useFetch`, `useRequestFetch`, `useRequestHeaders`). | read | M |
| D12 | `server: false` or `lazy` is used only where the data isn't needed for the first HTML. | read | m |
| D13 | Personal data is cleared from the client cache on sign-out (`clearNuxtData`, `refreshNuxtData`, or a reload). | read | m |

## 3. State

Sources: [State management](https://nuxt.com/docs/getting-started/state-management), [useState](https://nuxt.com/docs/api/composables/use-state), [useCookie](https://nuxt.com/docs/api/composables/use-cookie), [callOnce](https://nuxt.com/docs/api/utils/call-once).

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | Shared state that must survive SSR (signed-in user, locale) uses `useState` or a store that serializes into the payload, not a module-level `ref`. [@NathanCai193129] | read | M |
| S2 | No module-level mutable state on the server that leaks between requests or users. | read | M |
| S3 | Preferences the server must render, such as the currency, live in a cookie, not `localStorage`. Color mode may use `localStorage` with a script that runs before paint; H7 grades the flash. | read | M |
| S4 | One-time bootstrap (fetch the session) uses `callOnce`, a plugin, or middleware, and runs before route middleware needs it. | read | M |
| S5 | Local component state stays local (`ref` in the component), not in global state. | read | m |
| S6 | State has one source of truth; the same value isn't kept in two places that can drift (for example `going` in a store and a component). | read | m |
| S7 | Cookie options are deliberate: `sameSite`, `maxAge`, and `httpOnly`/`secure` for session cookies. | read | m |
| S8 | The URL is the state for filters (see P8); no duplicate filter state that falls out of sync with the URL. | read | m |
| S9 | The header changes at once after sign-in and sign-out. Sign-in updates without a full reload; sign-out may reload on purpose to drop personal data (see D13). | run | m |

## 4. SSR and hydration

Sources: [Hydration best practices](https://nuxt.com/docs/guide/best-practices/hydration), [NuxtTime](https://nuxt.com/docs/api/components/nuxt-time), [ClientOnly](https://nuxt.com/docs/api/components/client-only).

| ID | Check | How | |
| --- | --- | --- | --- |
| H1 | The event list, event page, header user and prices are in the first HTML (curl with and without a session cookie). | run | M |
| H2 | No hydration mismatch warnings in the browser console on the home, event, dashboard and sign-in pages, in a time zone and locale different from the server's. [@Joshua_WD, @li93196397] | run | M |
| H3 | No `window`, `document`, `localStorage` or `navigator` access during setup or render on the server. [@Joshua_WD] | read | M |
| H4 | Times render in the visitor's time zone without a mismatch (`NuxtTime`, a client-only formatter, or a time zone cookie). [@kyledotai] | both | M |
| H5 | `Date.now()`, `Math.random()`, or the server's time zone don't decide what a component renders on first paint. A value computed on the server and carried in the payload (an `started` flag from the API) is fine. | read | m |
| H6 | Signed-in users don't see a flash of the signed-out header on load. | run | M |
| H7 | Dark mode doesn't flash the light theme on load. | run | M |
| H8 | Prices don't flash from one currency to another on load. | run | M |
| H9 | Client-only widgets (charts, editors) are wrapped in `<ClientOnly>`, a `.client.vue` component, or render on the server. They don't break SSR. | read | m |
| H10 | Timers and listeners start in `onMounted` or client-only code and stop on unmount. | read | M |
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
| R6 | Route files follow the method suffix convention (`index.get.ts`, `rsvp.post.ts`) or check the method. | read | m |
| R7 | Route files export only the handler; shared logic lives in `server/utils` or similar. | read | m |
| R8 | Handlers return plain JSON-safe data; dates are ISO strings on the wire and the client types match. | read | m |
| R9 | In Nuxt 5 (server auto-imports off), server files import what they use from `nuxt/server`, `h3`, `nitro/*`, or the module, and nothing is imported that doesn't exist. [@silvesterwali] | read | M |
| R10 | Server code reads config with `useRuntimeConfig()`, not `process.env`. [@mayank0324] | read | M |
| R11 | Shared server helpers are imported through an alias (`#server/...`, `#shared/...`, `~~/...`) or auto-import, not long `../../../` chains. [@lucpotage] | read | m |
| R12 | Slow side effects (mail) run after the response (`event.waitUntil`, a queue, a background task), and their failure doesn't fail the RSVP. | read | M |
| R13 | The redirect for old links is a server route or route rule with a 301/308, not a client-side `navigateTo` after render. | read | M |
| R14 | Responses that depend on the user are not cached by a shared cache. | read | M |
| R15 | The CSV response sets `content-type: text/csv` and `content-disposition: attachment`. | run | m |
| R16 | The server doesn't rebuild what h3 or Nitro already provide (cookie parsing, body parsing, redirects, caching). [@leopoldk] | read | m |

## 6. Database

| ID | Check | How | |
| --- | --- | --- | --- |
| B1 | A real database (SQLite, libSQL, Postgres, D1...), not JSON files or memory. | read | M |
| B2 | The schema lives in code with migrations that can be applied to a fresh database. | read | M |
| B3 | Times are stored as UTC instants (timestamp or integer ms), with the event's IANA time zone stored next to them if the app shows venue time. [@kyledotai] | read | M |
| B4 | Money is stored as integer minor units (cents), not floats. | read | M |
| B5 | A unique constraint on (event, user) prevents duplicate RSVPs. | read | M |
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
| A9 | The auth secret comes from the environment, not from source code. | read | M |
| A10 | Sign-out ends the session on the server, not only on the client. | run | m |
| A11 | Auth state on the server is read per request (from headers or the event), not cached in a module. | read | M |

## 8. Validation

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The event form and the create/update routes use one schema (in `shared/` or imported by both). | read | M |
| V2 | Every form (event, sign-up, sign-in) shows field errors next to fields before submit, in the app's own words for every rule, limits and ranges included (not library defaults like "expected string, received undefined" or "Too big: expected string to have <=120 characters"), and the server repeats every rule. | both | M |
| V3 | Text fields are trimmed and length-limited; numbers are integers with a range. | read | m |
| V4 | The time zone is validated against IANA names, and the start can't be a date or time that doesn't exist at the venue (Feb 31, 02:30 on the night clocks jump forward). | both | M |
| V5 | Query filters are parsed with the same rules on the page and the API, and bad values fall back to defaults. | read | m |
| V6 | Server error messages reach the user (toast or inline), not a generic "Error". | run | m |
| V7 | A new event can't start in the past (an existing past event can still be edited). | run | m |

## 9. Caching and performance

Sources: [Nitro cache](https://nitro.build/guide/cache), [Route rules](https://nuxt.com/docs/guide/concepts/rendering#route-rules).

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | The exchange-rate call is cached on the server and shared by all visitors (`defineCachedFunction`, `cachedEventHandler`, KV, or a route rule), with a timeout. | read | M |
| C2 | A failed or slow rates service doesn't break the page; prices fall back to euros or a clear message. Test with a rates URL that never answers, on a cold cache: pages still answer in under 3 s. | both | M |
| C3 | Live seats stop polling (or close the stream) when the page is hidden or left. | run | M |
| C4 | Live seats use a small endpoint or stream, not a refetch of the whole event or list. | read | m |
| C5 | API responses and the page payload don't include fields the page doesn't render. | read | m |
| C6 | Heavy client libraries (charts) load only on the pages that use them, or are avoided. | read | m |
| C7 | Images, if any, have sizes and lazy loading. | read | m |
| C8 | Public, user-independent data (city list) is cached; user-dependent data is not. | read | m |

## 10. Time and money

| ID | Check | How | |
| --- | --- | --- | --- |
| T1 | The organizer enters the start in venue time with a time zone, and the stored instant is right across daylight-saving changes. A time that happens twice may map to either instant; a time that doesn't exist is refused or moved by a documented rule. [@kyledotai] | both | M |
| T2 | Visitors see start times in their own time zone; the event page also shows the venue's local time. | run | M |
| T3 | Relative times ("in 3 days") use `NuxtTime relative`, `useTimeAgo`, or `Intl.RelativeTimeFormat`, not hand-rolled strings. | read | m |
| T4 | Prices are formatted with `Intl.NumberFormat` and the right currency code. | read | M |
| T5 | Conversion uses rates from a real source and rounds only for display. | read | m |
| T6 | The confirmation email states the time with its time zone. | read | m |
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

## 12. Security

| ID | Check | How | |
| --- | --- | --- | --- |
| X1 | Secrets (auth secret, mail key, rates key) are server-only `runtimeConfig` or env, never `public` and never in the client bundle. | both | M |
| X2 | No `v-html` with user content. | read | M |
| X3 | CSV export defuses formula injection (`=`, `+`, `-`, `@` prefixes) and quotes fields. | both | m |
| X4 | Mutating routes are protected against cross-site requests (same-site cookies, origin check, or the auth library's CSRF handling). | read | M |
| X5 | No enumeration of other users' data through IDs (sequential IDs don't expose private data). | run | m |
| X6 | Error responses in production don't leak stack traces. | run | m |
| X7 | Dependencies are pinned or locked; no unused packages with install scripts. | read | m |

## 13. UI and theming

Sources: [Nuxt UI theme](https://ui.nuxt.com/docs/getting-started/theme), [Nuxt UI components](https://ui.nuxt.com/docs/components). Nuxt UI is not required. If it is used, its checks apply.

| ID | Check | How | |
| --- | --- | --- | --- |
| U1 | The brand color is set once as a theme token (Nuxt UI `app.config` + `@theme`, Tailwind theme, or CSS variables), not repeated as hex values in components. [@lucpotage] | read | M |
| U2 | Radius, spacing and color come from tokens, so a button and a dropdown match. [@lucpotage] | read | m |
| U3 | Text and buttons meet WCAG AA contrast in light and dark mode, including hover states, placeholders, form errors, alerts and status badges (#00DC82 on white is 1.8:1; Nuxt UI's default 500 shades for error and success fail on white too). | run | M |
| U4 | If Nuxt UI is used: props, slots and events match the installed version (no content in the wrong slot, no unknown props). Typecheck passes. [@CharlesYuDefine] | read | M |
| U5 | If Nuxt UI is used: component styling goes through `:ui`, `class` on the root, or `app.config`, not `!important` or deep selectors. [@CharlesYuDefine] | read | m |
| U6 | If a component library is installed, the app uses it instead of hand-building the same control. [@leopoldk, @NyllRe] | read | m |
| U7 | Loading states: buttons show progress, and a triple click on create, edit or RSVP sends one request; lists show a pending state. | run | m |
| U8 | Empty states for no results, no events, no attendees. | run | m |
| U9 | The layout works at 390 px wide without horizontal scroll. | run | m |
| U10 | Toasts or inline messages confirm RSVP, cancel, save and errors. | run | m |

## 14. Vue and reactivity

Sources: [Vue reactivity](https://vuejs.org/guide/essentials/reactivity-fundamentals.html), [Computed](https://vuejs.org/guide/essentials/computed.html), [Watchers](https://vuejs.org/guide/essentials/watchers.html), [VueUse](https://vueuse.org).

| ID | Check | How | |
| --- | --- | --- | --- |
| Q1 | Derived values use `computed`; `watch` is for side effects only. No watcher that only copies one ref into another when a computed would do. [@li93196397] | read | M |
| Q2 | No `computed` for constant values that never change. [@leopoldk] | read | m |
| Q3 | No `onMounted` + `$fetch` for data that SSR could load. [@li93196397] | read | M |
| Q4 | Timers, intervals and listeners use VueUse (`useIntervalFn`, `useEventListener`, `useDocumentVisibility`) or clean up by hand. [@leopoldk] | read | m |
| Q5 | Composables hold cohesive, reusable or stateful logic, not every small interaction. A single-use composable is fine when it groups one concern. [@weareupclose] | read | m |
| Q6 | Props and emits are typed with `defineProps<...>()`/`defineEmits<...>()`. | read | m |
| Q7 | No mutation of props or of `useFetch` data in place. | read | M |
| Q8 | `v-for` has stable keys (ids or slugs, not indexes). | read | m |
| Q9 | App code picks one style for auto-importable APIs (`ref`, `computed`, `useFetch`, components): it doesn't hand-import them in some files and rely on auto-imports in others. [@weareupclose] | read | m |
| Q10 | No `reactive` object replaced wholesale, and no reactive object destructured into plain values (reactive props destructure in Vue 3.5+ is fine). | read | m |

## 15. File organization and conventions

Sources: [Directory structure](https://nuxt.com/docs/guide/directory-structure), [shared/](https://nuxt.com/docs/guide/directory-structure/shared).

| ID | Check | How | |
| --- | --- | --- | --- |
| F1 | Code that runs in the browser, on the server, or in both is kept apart (Nuxt 4/5's `app/`, `server/` and `shared/`, or a configured equivalent), so server-only code can't end up in the client bundle. | read | M |
| F2 | Pages use file routing with dynamic params (`events/[slug]`), not one page that switches on a param. | read | m |
| F3 | Route middleware lives in `app/middleware` and is applied with `definePageMeta`. | read | m |
| F4 | Plugins are for app boot (session), not for page logic. | read | m |
| F5 | Server helpers live in `server/utils` (or a named folder) and route files stay thin. | read | m |
| F6 | Each component and module has one clear job; no 400-line page with everything inline. A small single-use component is fine when it names a concern. | read | m |
| F7 | Names say what things are (`RsvpPanel`, `findOwnedEvent`), not `utils2`, `helper`, `data`. | read | m |
| F8 | No dead code, commented-out code, unused files or unused dependencies. | read | m |
| F9 | Config lives in `nuxt.config.ts` and `app.config.ts`, not scattered in components. | read | m |
| F10 | Generated folders (`.nuxt`, `.output`, local database files, `.env`) are gitignored. | read | m |

## 16. TypeScript

| ID | Check | How | |
| --- | --- | --- | --- |
| Y1 | `nuxt typecheck` (or `vue-tsc --noEmit`) passes. | run | M |
| Y2 | No `any`, `as any`, `@ts-ignore` or `@ts-expect-error` without a reason in a comment. | read | M |
| Y3 | `$fetch`/`useFetch` results are inferred from the server routes, not re-declared by hand with `<T>`. | read | m |
| Y4 | Schema types are inferred (`z.infer`, Drizzle `$inferSelect`), not duplicated. | read | m |
| Y5 | Non-null assertions (`!`) only where the code just proved the value exists. | read | m |

## 17. Accessibility

| ID | Check | How | |
| --- | --- | --- | --- |
| W1 | Every input has a visible label tied to it. A compact header control whose value says what it is (a currency picker showing "USD") may use `aria-label` instead. | run | M |
| W2 | Everything works with the keyboard, with a visible focus ring. | run | M |
| W3 | The seats-left count is announced to screen readers when it changes (`aria-live`). | read | m |
| W4 | Icon-only buttons have an accessible name. | run | m |
| W5 | The chart has a text alternative. | read | m |
| W6 | Headings form an order (one `h1` per page). | run | m |
| W7 | Error and success messages are announced (toasts with role, or inline text near the field). | run | m |

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
| K1 | `nuxt build` output runs with `node .output/server/index.mjs` (or the chosen preset's documented command). | run | M |
| K2 | Every setting that differs per environment (database, auth secret, mail, rates) is a runtime config key or env variable, documented in the README or `.env.example`, and the documented production start loads it. | read | M |
| K3 | Migrations run as an explicit step (script or startup hook), documented. | read | M |
| K4 | No dev-only behavior in production (dev outbox, seed routes open to anyone, debug logs). | read | M |
| K5 | The README says how to run and seed, and the README or an `.env.example` it points to says how to configure mail and the rates service. | read | m |
| K6 | Versions target Nuxt 5, Nitro 3 and h3 2. No Nuxt 3 or Nitro 2 APIs (`nitropack`, `defineNitroPlugin` from the wrong place, h3 v1 `event.node`). | read | M |

## 20. The agent's own verification

Read from the session log, not the code. n/a for the reference app, which has no agent session.

| ID | Check | How | |
| --- | --- | --- | --- |
| Z1 | The agent ran a production build. | log | M |
| Z2 | The agent ran the type checker. | log | m |
| Z3 | The agent exercised the app (curl, browser, or tests), not only the build. | log | M |
| Z4 | The agent checked the browser console or hydration. [@li93196397] | log | m |
| Z5 | The agent tested the concurrency rule (two seats, many requests) or wrote a test for it. | log | m |
| Z6 | The final message lists what was done, what wasn't, and how to run it, without claiming checks it didn't run. | log | m |

---

## Where the checks come from

| Reply on X | Checks |
| --- | --- |
| @CharlesYuDefine: Nuxt UI slots and props from stale memory; top-level `$fetch`; unstable `useAsyncData` keys | U4, U5, D1, D6 |
| @li93196397: too much `watch` and `onMounted`; doesn't check hydration or console errors | Q1, Q3, H2, H11, Z4 |
| @weareupclose: imports auto-imported things; a composable for every interaction | Q9, Q5 |
| @Joshua_WD: touches `window` during setup; hydration mismatches | H2, H3 |
| @leopoldk: `computed` that never recomputes; rebuilds what Nuxt, Nitro, h3 or VueUse ship | Q2, Q4, R16, U6 |
| @BoboLinNotes, @mayank0324, @zyeutequebec, @adarshmadrecha: `$fetch` vs `useFetch`; `process.env` instead of runtime config | D1, D2, R10 |
| @silvesterwali: server auto-imports | R9 |
| @lucpotage: relative paths instead of aliases; Nuxt UI global vs local overrides, app.config vs CSS variables | R11, U1, U2 |
| @NathanCai193129: `ref` instead of `useState` | S1 |
| @kyledotai: time zones when storing and showing timestamps | B3, H4, T1, T2 |
| @NyllRe: hand-writes what Nuxt UI ships | U6 |
| @_onmax (the question): h3 utils like `readValidatedBody` | R1, R2 |
