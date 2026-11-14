# Signed-in pages flash Sign in: fix rubric

How we grade a fix of the report in [PROMPT.md](PROMPT.md). The agent got the Meetups app with the session read moved to the browser: the session plugin became client-only (`session.client.ts`, not awaited), the layout and the RSVP panel each call `fetchSession()` in `onMounted`, and the `auth` middleware awaits `fetchSession()` when no user is set. The server renders every public page signed out, the header shows "Sign in" until the browser's reads come back, and a signed-in hard load of an event page sends `get-session` three times. Each check passes, fails, or does not apply (n/a).

Rules for graders:

- Grade the agent's change, from the patch and the code. The rest of the app is the same in every run.
- The ranked solutions in S1 and S2 are the ones we know. A fix that matches none is graded on its merits; say "novel" in the evidence of S1.
- Each check names how to verify it: **run**, **read**, **log** (from the agent's session log), or **both**. **M** marks a major check, **m** a minor one.

Gate: F1
Weights: R 20, S 45, P 15, C 10, V 10

A run that fails the gate scores 0: the report isn't fixed. Otherwise sections score as in the Meetups rubric (a major check weighs 3, a minor one 1), the weights above share the rubric part, and Vite Doctor's score counts as in Meetups.
---

## 1. Fixed

A script runs these against the production build. F1 is the gate.

| ID | Check | How | |
| --- | --- | --- | --- |
| F1 | A signed-in visitor's hard load of an event page, watched for 3 seconds after load, sends no browser request that reads the session (`/api/auth/get-session`, or any other request whose answer carries their email), and the page shows their name. | run | M |
| F2 | The server HTML of that event page already shows the signed-in visitor's name in the header, so nothing flashes "Sign in". | run | M |

## 2. Root cause

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | The agent's final message names the cause: the session is read only in the browser, so the server renders the page signed out, and each component reads its own copy on mount instead of sharing one read carried from the server in the payload. A message that only says "too many requests" or blames the network fails. | log | M |
| R2 | The change is in how the session is loaded and shared (the plugin, `useAuth()`, the components' reads, the middleware), not only in how the header looks while it loads. | read | m |

## 3. Solution

Ranked solutions we know:

- **Best:** one session read per request, on the server, kept in `useState` and carried in the payload: a universal plugin that runs `fetchSession()` once with `callOnce` (or awaits it), with the reads in `onMounted` removed. The browser makes no read on a hard load.
- **Acceptable:** one shared keyed `useAsyncData`/`useFetch` for the session, run on the server, whose result the browser reuses from the payload (a fixed key, `getCachedData`, `dedupe`); the middleware reading the server's session when the plugin hasn't, as long as the payload carries it.
- **Over-engineered:** a server cache of sessions keyed by cookie (in memory, KV or LRU: revocation lags), a new state library such as Pinia for one user object, a new `/api/me` endpoint with its own store.
- **Masks the symptom:** `lazy: true` or `server: false` on the reads, `<ClientOnly>` or a skeleton around the header, hiding the header until the browser's read returns, debouncing or caching the calls in the browser only.
- **Wrong:** a module-level `ref` or variable that holds the user on the server: one user's session leaks to the next request.

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | The fix is the best solution or an acceptable one from the list above (or a novel one as sound). | read | M |
| S2 | The fix is the best one: the server reads the session once per request, the payload carries it, and no component reads it again on mount. | read | M |
| S3 | Nothing over-engineered: no session cache on the server, no new state library or dependency, no new endpoint just to read the user. | read | M |
| S4 | No masking and no cross-user state: no `lazy`, `server: false`, `<ClientOnly>` or skeleton in place of the fix, and no module-level variable holding the user on the server. | read | M |

## 4. Platform

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | The fix uses Nuxt's own primitives for request state and data (`useState`, `callOnce`, a universal plugin, `useRequestFetch`, `useAsyncData`/`useFetch`) and the app's own `useAuth()` and Better Auth route, with no second auth client or hand-made payload. | read | M |

## 5. No collateral damage

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | A clean clone installs, migrates, builds and starts with the commands in its README. | run | M |
| C2 | A signed-in visitor's hard load of `/dashboard` opens their dashboard, and a signed-out visitor's is sent to `/sign-in`. (Scripted.) | run | m |
| C3 | The change touches only what the fix needs, and signing in, signing up and signing out still update the header. Tests and notes the fix needs are fine; rewrites of unrelated files are not. | read | m |

## 6. Verification

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The agent reproduced the problem before changing the code: counted the browser's `get-session` requests, saw the signed-out server HTML with a session cookie, or reasoned it through from the code and said so. | log | M |
| V2 | The agent showed the fix works after the change: the same count or server HTML, or a test it kept in the repo. | log | m |
