# Meetups (project 1, dev set)

The first real eval project. The agent gets a partly built Nuxt 5 app and a product prompt with twelve features. Version 2 (2026-11-07) added features 7 to 12, search as you type, an instant Back, a not-found page with the layout, a canonical address and a double-click guard, so that Sol 6.1 xhigh, which scored 91% on version 1, has room to fail. The probes grade how the agent built them: what the server sends, what the browser fetches, what leaks, and what costs money. Any correct form passes.

## What the agent gets

- `PROMPT.md`: the twelve features in product words. It never names a composable, util, module or config key. It does name the URL format, the button and field labels, the currency format and the env variables ops already set, because those are product and ops facts.
- `fixture/`: Nuxt `5.0.0-2611070044-e3875e8` (nightly), Nitro `3.0.261103-rc`, h3 `2.0.8`, Vue `3.5.44`, `@nuxt/ui` `4.12.0`, `@vueuse/nuxt` `15.0.0`, `chart.js` `4.5.1`, `zod` `4.6.7`, all pinned with a lockfile. It has:
  - `server/data/events.ts`: 2,000 seeded events in memory, each with a long description, 10 to 40 attendees with emails and a change history (about 5 kB each).
  - `server/data/users.ts` and `server/utils/session.ts` with `getSessionUser(event)`. A lookup waits 15 ms, like a remote session store, so concurrent requests interleave on the server as they do in production. `/login` signs in as Ada or Grace (organizers) or Linus (member).
  - `server/utils/mailer.ts` with `sendMail()`.
  - `services/fake-services.mjs`: the slow paid exchange-rate API (800 ms, Bearer key, counts billed calls) and the slow mailer (1.5 s, counts mails). `pnpm services` runs it for the agent; the grader runs its own copy.
  - `docs/rates-api.md`: the provider's docs (secret key, rotated without a rebuild, billed per request, hourly rates).
  - `.env` with local values. The grader never uses it.

`fixture/` has no `node_modules`. `prepareWorkingCopy()` in `cli/lib/prepare.ts` gives each working copy a copy of a cached install and runs `nuxt prepare` (about 4 s with a warm cache).

## Features, probes, and the forms they tell apart

"Reply" is the item from the replies to [Maxi's post on X](https://x.com/_onmax/status/2119005553775030726) on 2026-11-07:

1. Nuxt UI from stale memory: content in the default slot instead of `#body`, `class` instead of `:ui`, `app.config.ts` vs CSS variables (@CharlesYuDefine, @lucpotage).
2. Data fetching: top-level `$fetch` in setup, `useFetch` vs `$fetch`, double requests (@BoboLinNotes, @mayank0324, @zyeutequebec, @adarshmadrecha).
3. Too many `watch` and `onMounted`, and no check for hydration or console errors (@li93196397).
4. `window` touched during setup, which only breaks on SSR (@Joshua_WD).
5. `process.env` where runtime config belongs (@mayank0324).
6. Imports: missed server auto-imports, relative paths instead of aliases, importing what is auto-imported, a composable for every tiny interaction (@silvesterwali, @lucpotage, @weareupclose).
7. h3 utils such as `readValidatedBody` (Maxi's post, @BoboLinNotes).
8. Modules used together: Content, Studio, SEO, i18n, Image (@lucpotage, @StiekemeHenk).
9. `ref` instead of `useState` (@NathanCai193129, later the same day).

| Feature | Probe | Right forms | Tempting wrong form | Reply |
| --- | --- | --- | --- | --- |
| Gate | `build` | `nuxt build` passes | | |
| Gate | `pages-respond` | `/`, `/events`, an event page, `/login` answer 200 | `window` or `navigator` in setup crashes SSR | 4 |
| 1 List | `list-ssr` | `useFetch`/`useAsyncData` driven by `route.query` | data loaded in `onMounted` | 2, 3 |
| 1 List | `list-no-client-fetch` | SSR data reused on hydration | top-level `await $fetch` in `<script setup>` | 2 |
| 1 List | `list-url-changes` | one reactive fetch keyed on the query; state read from the URL | `watch(route.query, refresh)` next to a reactive `useFetch` (2 requests per change); filters in local refs | 2, 3 |
| 1 List | `list-payload` | the API (or `pick`/`transform`) returns only list fields | full event records in the payload (100 kB) | 2 |
| 2 Event | `event-meta` | `useSeoMeta`/`useHead` in setup | `useHead` in `onMounted` | 3 |
| 2 Event | `event-404` | `throw createError({ status: 404, fatal: true })` | a "not found" text on a 200 page | |
| 3 Times | `no-hydration-errors` | `<NuxtTime>`, `<ClientOnly>`, or formatting after mount | `toLocaleString()` during render (browser in Auckland, server in UTC) | 3 |
| 4 RSVP | `rsvp-dialog` | `UModal` with the button in the default slot and the form in `#body` | Nuxt UI v2 memory: `v-model` instead of `v-model:open`, form in the default slot | 1 |
| 4 RSVP | `rsvp-client-check` | `UForm :schema` or `:validate` | a form that only reports server errors | 1, 7 |
| 4 RSVP | `rsvp-server-400` | `readValidatedBody(event, schema)` or `schema.parse` with a 400 | hand-rolled checks that answer 200 with `{ ok: false }` | 7 |
| 4 RSVP | `rsvp-rules-once` (static) | one schema in `shared/` used by the form and the route | the same rules copied into the form and the route | 7 |
| 4 RSVP | `rsvp-fast-mail` | `event.waitUntil(sendMail(...))` | `await sendMail(...)` before answering | |
| 5 Prices | `price-ssr` | currency from `Accept-Language` on the server | `navigator.language` in the browser; key baked into public config | 4, 5 |
| 5 Prices | `price-cached` | `defineCachedFunction`, storage, or a shared in-memory cache | one upstream call per page view | |
| 5 Prices | `price-key-private` | private `runtimeConfig` read on the server | `runtimeConfig.public` with the key | 5 |
| 5 Prices | `price-runtime-config` (static) | `useRuntimeConfig()` | `process.env.NUXT_RATES_API_KEY` in server code | 5 |
| 6 Dashboard | `dashboard-guard` | route middleware with `navigateTo` and a 403 error | a redirect in `onMounted`; no role check | 3 |
| 6 Dashboard | `dashboard-ssr` | `useFetch` or `useRequestFetch` (they forward the cookie) | `$fetch` inside `useAsyncData` (no cookie on the server) | 2 |
| 6 Dashboard | `attendees-private` | APIs return only what each page shows | whole event records from list or event APIs | 2 |
| 6 Dashboard | `chart-split` | chart imported by the dashboard (or its component) only | `Chart.register()` in a global plugin | |
| 1 List | `search-live` | results follow the search box without Enter, and the URL keeps it | search only on submit | |
| 1 List | `search-debounced` | `refDebounced`, `watchDebounced` or a timer: at most 2 requests for 8 keys | a request per key press | 2 |
| 7 Header | `header-user-per-request` | `useFetch`/`useState` per request | a module-level `ref` filled by a plugin: on the server every visitor shares it | 9 |
| 8 Currency | `currency-choice-remembered` | `useCookie`, read by the server | VueUse `useLocalStorage` | 4 |
| 9 Live seats | `seats-live` | polling or a stream that updates the number | | |
| 9 Live seats | `seats-stop-on-leave` | `useIntervalFn`, `useEventSource` or cleanup in `onUnmounted` | `setInterval` in `onMounted` without cleanup | 3 |
| 9 Live seats | `seats-pause-hidden` | `useDocumentVisibility` + `pause`/`resume` | polling a hidden tab | 3 |
| 10 Brand | `brand-color` | `--ui-primary` or a brand color scale in the theme | Tailwind `green`, or classes on single components | 1 |
| 10 Brand | `brand-corners` | `--ui-radius` or `app.config` slots | `rounded-*` classes on the new components only | 1 |
| 10 Dark mode | `dark-no-flash` | Nuxt UI's color mode (`UColorModeButton`, `useColorMode`) | VueUse `useDark`, which applies after the app boots | 3 |
| 11 Old links | `old-links-permanent` | `navigateTo(..., { redirectCode: 301 })` or a server route with 301 | `navigateTo` with its default 302 | |
| 12 Export | `csv-download` | a route that returns a `Response` with `text/csv` and `content-disposition` | `setResponseHeader` from `nuxt/server`, which Nuxt 5 doesn't export (build fails) | 6 |
| 12 Export | `csv-owner-only` | the route checks the event's organizer | a role check only, or a guard on the page only | |
| 1 List | `list-back-instant` | `getCachedData` that reuses the payload, or a kept-alive page | the default `useFetch`, which refetches after the cached data is purged | 2 |
| 2 Event | `not-found-page` | `error.vue` that renders `<NuxtLayout>` and links to `/events` | the default error page, or a catch-all page that answers 200 | |
| 2 Event | `event-canonical` | `useHead` canonical link built from the slug | no canonical, or one copied from the request URL with its query | |
| 4 RSVP | `rsvp-once` | `loading-auto` on the submit button, or a pending flag | a submit button that stays active while the request runs | 1 |

Not probed, left to the judge: Nuxt UI `:ui` vs `class`, `app.config.ts` vs CSS variables and hand-written elements (reply 1), `useAsyncData` keys that include page or sort and `globalThis.$fetch` overrides (reply 2), server auto-imports and aliases (reply 6). Reply 8 (Content, i18n, Image) is for project 2. `header-user-per-request` covers reply 9.

### How the probes see the app

- The grader copies the working copy without `node_modules`, `.nuxt`, `.output` and `.env*` to `~/.cache/nuxt-evals/verify/`, gives it the cached install (or `pnpm install` when the agent changed the manifests), writes a `.env` with a build-time rates key, and runs `nuxt build` through `heavy`.
- It starts `.output/server/index.mjs` with `TZ=UTC` on a free port in 4810 to 4889 and the fake services on a free port in 4890 to 4899, with a different rates key than the build saw. The fake API accepts only the runtime key, so a price on the page proves the key came from the environment at runtime.
- HTTP probes don't follow redirects. Browser probes use headless Chromium from `playwright-core`. Filter changes go through the app's own Vue Router (`#__nuxt.__vue_app__`), so they don't depend on the agent's markup. The RSVP probes find the form by the labels the prompt names (Name, Email, Seats), capture the request the form sends, and replay it with bad values.
- Expected results come from the same seeded store (`fixture/server/data/events.ts`), imported by the grader.
- `stop()` kills only the server it started, closes the fake services and the browser, and deletes the verify copy (`NUXT_EVALS_KEEP_VERIFY=1` keeps it).

## References

`references/reference/` passes every probe. Each `references/wrong-*` folder is laid over the reference and changes only what it gets wrong:

- `wrong-fetch`: top-level `await $fetch`, `watch` + `refresh` next to `useFetch`, full records from the list API, no 404, `$fetch` without the cookie on the dashboard.
- `wrong-ssr`: list loaded in `onMounted`, `toLocaleString()` times, `useHead` in `onMounted`, currency from `navigator.language`, Nuxt UI v2 modal API, chart in a global plugin, dashboard guard in `onMounted`.
- `wrong-server`: `process.env` and no cache for rates, hand-rolled RSVP checks copied into form and route that answer 200, `await sendMail()`.
- `wrong-client`: the tempting forms of features 7 to 12: a module-level `ref` for the user, VueUse `useLocalStorage` for the currency and `useDark` for the theme, `setInterval` without cleanup, a fetch per key press, Tailwind green and per-component corners, a 302 for old links, and a CSV route that checks only the role.
- `wrong-leaky`: the rates key in public runtime config, full event records from the event API, no role check, no client validation.

Run them:

```sh
node tasks/meetups/references/check.ts --runs 3            # every solution
node tasks/meetups/references/check.ts --runs 1 wrong-ssr  # one solution
```

It prints one line per probe with its time and a stability table, and writes the table to `~/.cache/nuxt-evals/meetups-check.md`.

### Stability of version 1 (2026-11-07, 3 runs each)

Version 2 adds 17 probes (39 in all). One run on 2026-11-07: the reference passes all 39, and `wrong-client` fails exactly its 17 targets (16 new probes plus `list-no-client-fetch`, since its plugin also fetches the user in the browser). `rsvp-server-400` now accepts 422 as well, and feature 5 now says prices must be right in the first HTML.

| probe | reference | wrong-fetch | wrong-leaky | wrong-server | wrong-ssr |
| --- | --- | --- | --- | --- | --- |
| build | pass ×3 | pass ×3 | pass ×3 | pass ×3 | pass ×3 |
| pages-respond | pass ×3 | pass ×3 | pass ×3 | pass ×3 | pass ×3 |
| list-ssr | pass ×3 | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 |
| list-no-client-fetch | pass ×3 | FAIL ×3 | pass ×3 | pass ×3 | FAIL ×3 |
| list-url-changes | pass ×3 | FAIL ×3 | pass ×3 | pass ×3 | pass ×3 |
| list-payload | pass ×3 | FAIL ×3 | pass ×3 | pass ×3 | pass ×3 |
| event-meta | pass ×3 | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 |
| event-404 | pass ×3 | FAIL ×3 | pass ×3 | pass ×3 | pass ×3 |
| no-hydration-errors | pass ×3 | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 |
| rsvp-dialog | pass ×3 | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 |
| rsvp-client-check | pass ×3 | pass ×3 | FAIL ×3 | pass ×3 | FAIL ×3 |
| rsvp-server-400 | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 | FAIL ×3 |
| rsvp-rules-once | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 | pass ×3 |
| rsvp-fast-mail | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 | FAIL ×3 |
| price-ssr | pass ×3 | pass ×3 | FAIL ×3 | pass ×3 | FAIL ×3 |
| price-cached | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 | pass ×3 |
| price-key-private | pass ×3 | pass ×3 | FAIL ×3 | pass ×3 | pass ×3 |
| price-runtime-config | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 | pass ×3 |
| dashboard-guard | pass ×3 | pass ×3 | FAIL ×3 | pass ×3 | FAIL ×3 |
| dashboard-ssr | pass ×3 | FAIL ×3 | pass ×3 | pass ×3 | pass ×3 |
| attendees-private | pass ×3 | FAIL ×3 | FAIL ×3 | pass ×3 | pass ×3 |
| chart-split | pass ×3 | pass ×3 | pass ×3 | pass ×3 | FAIL ×3 |

### Time per grading

- Start (copy, cached install, `nuxt build`, server up): 6 s when `heavy` has a free slot, up to 60 s when it queues. The build alone takes about 6 s.
- All 20 probes: about 15 to 25 s. The slow ones are the browser probes: `rsvp-dialog` (the shared RSVP scenario, 3 to 14 s), `no-hydration-errors` (3 to 4 s), `list-url-changes` (3 to 5 s), `rsvp-fast-mail` (3 s, it waits for the mail) and `list-no-client-fetch` (1 to 8 s).
- One grading: 20 to 90 s in total.

## Known limits

- The store dates start at midnight UTC of the day the process starts. A grading run that crosses midnight UTC can shift the expected list by a day.
- In `wrong-ssr` the broken modal also makes the form unusable, so the three RSVP probes after the dialog fail too. That is what a visitor would see.
- `price-cached` makes 50 HTTP page views; a price that only the browser fetches makes no upstream calls there, and `price-ssr` catches it instead.
- One reference solution only. Plan-v2 asks for two in different styles before the probes are frozen.
