# Event page shows another user's data: fix rubric

How we grade a fix of the reports in [PROMPT.md](PROMPT.md). The agent got the Meetups app with the event route's body wrapped in a cached function keyed by the slug alone. The cached value carries `going` and `isOrganizer`, which depend on the visitor, so for a minute every visitor gets the first visitor's answers. Each check passes, fails, or does not apply (n/a).

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
| F1 | Right after an organizer opens their event, another signed-in visitor and a signed-out visitor get `isOrganizer: false` and `going: false` from `/api/events/<slug>`; after the second visitor RSVPs, they get `going: true` and a third visitor still gets `going: false`, all within the same minute. | run | M |

## 2. Root cause

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | The agent's final message names the cause: the event route caches a value that depends on the visitor (`going`, `isOrganizer`) under a key that doesn't (the slug), so visitors get each other's answers. | log | M |
| R2 | The change is in the event route's cache, not in the page or the components that show the button. | read | m |

## 3. Solution

Ranked solutions we know:

- **Best:** cache only the part every visitor shares (the event, the organizer's name) under the slug, and compute `going` and `isOrganizer` per request; or drop the cache, since the route is a few indexed reads.
- **Acceptable:** keep the cached function and add the user to the key (`getKey: (slug, userId) => ...`): correct, but one entry per visitor per event.
- **Over-engineered:** a client-side store or a cache service to work around the shared entry.
- **Masks the symptom:** a shorter `maxAge`; hiding the Edit button on the client while the API still says `isOrganizer: true`.
- **Wrong:** `defineCachedHandler` with `varies: ['cookie']` or a cache keyed by the cookie: an entry of personal data per session cookie.

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | The fix is the best solution or an acceptable one from the list above (or a novel one as sound). | read | M |
| S2 | The fix is the best one: no cached value depends on the visitor, either because only the shared part is cached or because the route isn't cached. | read | M |
| S3 | Nothing over-engineered: no new store, cache service, table or dependency. | read | M |
| S4 | No masking: the change doesn't stop at a shorter cache time or a client-side check. | read | M |

## 4. Platform

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | Any cache left in the route uses Nitro's own `defineCachedFunction` or `defineCachedHandler` with a key that covers everything the cached value depends on, as the Nitro docs describe; no hand-written cache (a module `Map`, a KV get-then-set). | read | M |

## 5. No collateral damage

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | A clean clone installs, migrates, builds and starts with the commands in its README. | run | M |
| C2 | Seats left on `/api/events/<slug>` drops right after an RSVP, not a minute later. (Scripted.) | run | m |
| C3 | The change touches only what the fix needs. Tests and notes are fine; rewrites of unrelated files are not. | read | m |

## 6. Verification

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The agent reproduced the leak before changing the code: two visitors' requests, a script or a test that showed one visitor's answer to another, or the agent traced it from the code and said so. | log | M |
| V2 | The agent showed the fix works after the change: the same reproduction, or a test it kept in the repo. | log | m |
