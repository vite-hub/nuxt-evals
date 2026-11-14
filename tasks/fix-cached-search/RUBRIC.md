# Search and pages show the same events: fix rubric

How we grade a fix of the report in [PROMPT.md](PROMPT.md). The agent got the Meetups app with the events list route wrapped in Nitro's `defineCachedHandler`. In Nitro v3 a cached handler passes no query parameters to the handler or the cache key unless `allowQuery` lets them through, so every search, city and page gets the first cached list. Each check passes, fails, or does not apply (n/a).

Rules for graders:

- Grade the agent's change, from the patch and the code. The rest of the app is the same in every run.
- The ranked solutions in S1 and S2 are the ones we know. A fix that matches none is graded on its merits; say "novel" in the evidence of S1.
- Each check names how to verify it: **run**, **read**, **log** (from the agent's session log), or **both**. **M** marks a major check, **m** a minor one.

Gate: F1
Weights: R 20, S 45, P 15, C 10, V 10

A run that fails the gate scores 0: the report isn't fixed. Otherwise sections score as in the Meetups rubric (a major check weighs 3, a minor one 1), the weights above share the rubric part, and Vite Doctor's score counts as in Meetups.
---

## 1. Fixed

A script runs it against the production build. It is the gate.

| ID | Check | How | |
| --- | --- | --- | --- |
| F1 | After the unfiltered list has been requested, `/api/events` with a city returns only that city's events, page 2 of that city returns the events page 1 doesn't, and a search for a word in one title returns that event alone. | run | M |

## 2. Root cause

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | The agent's final message names the cause: the cached handler drops the query string (Nitro v3 lets no query parameters through by default), so the handler and the cache key never see `q`, `city` or `page`. A message that only says "the cache is stale" fails. | log | M |
| R2 | The change is in the events list route's cache, not in the page or its `useFetch` call. | read | m |

## 3. Solution

Ranked solutions we know:

- **Best:** keep the cache and let the three parameters through: `allowQuery: ['q', 'city', 'page']`.
- **Acceptable:** `allowQuery: true` (any query string makes a new cache entry); drop the cache, since the query is indexed and fast.
- **Over-engineered:** a hand-written cache in KV or a module `Map` keyed by the URL; a cache layer in the page.
- **Masks the symptom:** a shorter `maxAge`; cache-busting parameters added on the client.
- **Wrong:** a `getKey` built from the URL: the handler still never sees the query, because Nitro filters it before the handler runs.

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | The fix is the best solution or an acceptable one from the list above (or a novel one as sound). | read | M |
| S2 | The fix is the best one: the cache stays and `allowQuery` names the parameters the route reads. | read | M |
| S3 | Nothing over-engineered: no hand-written cache, new store or dependency. | read | M |
| S4 | No masking: the change doesn't stop at a shorter cache time or client-side cache busting. | read | M |

## 4. Platform

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | The fix uses the cached handler's own options as the Nitro v3 docs describe (`allowQuery`, or removing `defineCachedHandler`), with no workaround around Nitro's query filtering. | read | M |

## 5. No collateral damage

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | A clean clone installs, migrates, builds and starts with the commands in its README. | run | M |
| C2 | The home page's server HTML for a search shows the matching event. (Scripted.) | run | m |
| C3 | The change touches only what the fix needs. Tests and notes are fine; rewrites of unrelated files are not. | read | m |

## 6. Verification

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The agent reproduced the problem before changing the code: two requests with different queries that came back the same, a script or a test, or the agent traced it from the code and said so. | log | M |
| V2 | The agent showed the fix works after the change: the same requests, or a test it kept in the repo. | log | m |
