# Every page fails after sign-in: fix rubric

How we grade a fix of the report in [PROMPT.md](PROMPT.md). The agent got Notebook, a small Nuxt 5 app over an API that takes the user's token only in an `Authorization: Bearer <token>` header. Sign-in stores the token in the `token` cookie, but no request sends the header, so every call to `/api` answers 401. Each check passes, fails, or does not apply (n/a).

The case comes from [nuxt-agent-pitfalls](https://github.com/Charles5277/nuxt-agent-pitfalls) (check 2c): asked to add an auth header to every `/api` request, most agents reassign `globalThis.$fetch` in a plugin. In Nuxt 5 that changes nothing: neither `useFetch` nor `$fetch` sends the header, on the server or in the browser (checked on this app's Nuxt nightly, 2026-11-15). The Nuxt docs' [custom useFetch recipe](https://nuxt.com/docs/5.x/guide/recipes/custom-usefetch) is the fix.

Rules for graders:

- Grade the agent's change, from the patch and the code. The rest of the app is the same in every run.
- The ranked solutions in S1 and S2 are the ones we know. A fix that matches none is graded on its merits; say "novel" in the evidence of S1.
- Each check names how to verify it: **run**, **read**, **log** (from the agent's session log), or **both**. **M** marks a major check, **m** a minor one.

Gate: F1, F2
Weights: R 20, S 45, P 15, C 10, V 10

A run that fails the gate scores 0: the report isn't fixed. Otherwise sections score as in the Meetups rubric (a major check weighs 3, a minor one 1), the weights above share the rubric part, and Vite Doctor's score counts as in Meetups.

---

## 1. Fixed

A script runs these against the production build. They are the gate.

| ID | Check | How | |
| --- | --- | --- | --- |
| F1 | The server HTML of `/` for a visitor with a valid `token` cookie lists their notes, and the server HTML of one of their notes shows its text. | run | M |
| F2 | In Chromium, signing in through the form shows the notes, clicking a note opens it, and adding a note shows it in the list; every request to `/api` after sign-in carries `Authorization: Bearer <token>`. | run | M |

## 2. Root cause

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | The agent's final message names the cause: the API reads the token only from the `Authorization` header, and no request from the web app sends it (the cookie alone doesn't count). | log | M |
| R2 | The change is in the web app (`app/`), not in the API under `server/`. | read | m |

## 3. Solution

Ranked solutions we know:

- **Best:** the docs' recipe. One `$fetch.create()` instance whose `onRequest` sets the header from `useCookie('token')`, provided by a plugin (or built in a composable), and a custom `useFetch` that uses it (`createUseFetch`, or a `useAPI` wrapper that passes it as `$fetch`). Every page and handler calls through them, so a request added later gets the header with no extra code.
- **Acceptable:** a shared `useAPI` composable that passes `headers` built from the cookie to `useFetch`, plus a shared helper for event handlers that does the same for `$fetch`.
- **Partial:** an `Authorization` header added by hand to each existing call. It works today, but every new call has to remember it.
- **Over-engineered:** a new HTTP client dependency (axios, ky), a store for the token, or a wrapper that reimplements `useFetch`'s keys, caching or SSR transfer.
- **Wrong:** reassigning `globalThis.$fetch` (or `$fetch`) in a plugin, which nothing reads; patching `window.fetch`, which misses the server render; making the API read the cookie or a server middleware that copies the cookie into the header (the API isn't the web app's, and cookie auth on it needs CSRF protection it doesn't have); forwarding the cookie with `useRequestHeaders`, which the API ignores.

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | The fix is the best solution or an acceptable one from the list above (or a novel one as sound). | read | M |
| S2 | The fix is the best one: every call to the API goes through one shared fetch instance or composable that adds the header, so a new call needs nothing extra. | read | M |
| S3 | Nothing over-engineered: no new dependency, store or reimplementation of `useFetch`. | read | M |
| S4 | No wrong solution: no reassignment of the global `$fetch` or `fetch`, and no change to how the API authenticates. | read | M |

## 4. Platform

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | The header comes from Nuxt's own tools, as the docs describe: `$fetch.create()` with `onRequest` (or `useFetch`'s `headers` or `$fetch` option) and `useCookie`; on the server the token is read from the current request, never kept in module scope. | read | M |
| P2 | Data the page renders is still fetched with `useFetch` or `useAsyncData` (or a custom `useFetch`), so the server render's data reaches the browser without a second request. | read | m |

## 5. No collateral damage

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | A clean clone installs, builds and starts with the commands in its README. | run | M |
| C2 | Two users' pages rendered at the same moment each show only that user's notes. (Scripted.) | run | M |
| C3 | A visitor with no token is still sent to the sign-in page. (Scripted.) | run | m |
| C4 | The change touches only what the fix needs. Tests and notes are fine; rewrites of unrelated files are not. | read | m |

## 6. Verification

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The agent reproduced the failure before changing the code: a request that showed the 401, a script or a test, or the agent traced it from the code and said so. | log | M |
| V2 | The agent showed the fix works after the change, on the server render and in the browser (or with a test it kept in the repo). | log | m |
