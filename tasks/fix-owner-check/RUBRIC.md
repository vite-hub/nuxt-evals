# Strangers can edit an event: fix rubric

How we grade a fix of the report in [PROMPT.md](PROMPT.md). The agent got the Meetups app with the event edit route and the cover delete route checking only that someone is signed in: they look the event up by slug and never check that the visitor organizes it. The read routes (attendee list, CSV) and the cover upload still check ownership. Each check passes, fails, or does not apply (n/a).

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
| F1 | A signed-in visitor who doesn't organize an event gets 403 or 404 when they edit it (`PATCH /api/events/<slug>`) or remove its cover (`DELETE /api/events/<slug>/cover`), and the event's title, date and cover stay as they were. | run | M |

## 2. Root cause

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | The agent's final message names the cause: the edit and cover-removal routes check that someone is signed in but not that they organize the event. A message that only mentions the edit route, or blames the UI, fails. | log | M |
| R2 | The change is in the server routes (or the helper they share), not in the page that shows the Edit button. | read | m |

## 3. Solution

Ranked solutions we know:

- **Best:** both routes use the ownership lookup the other organizer routes use (`findOwnedEvent(slug, user.id)`), which answers 404 to a stranger.
- **Acceptable:** an inline `organizerId !== user.id` check in each route; the organizer condition in the `UPDATE`'s `WHERE` with 0 rows answering 404; 403 instead of 404.
- **Over-engineered:** a role or permission framework, a new middleware layer or a policy library for one rule.
- **Masks the symptom:** hiding the Edit button or the remove-cover button; a client-side check.
- **Wrong:** route middleware on the pages (`/dashboard/**`, `/events/*/edit`): it never runs for API calls.

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | The fix is the best solution or an acceptable one from the list above (or a novel one as sound). | read | M |
| S2 | The fix is the best one: both routes reuse the app's existing ownership check instead of writing a new one. | read | M |
| S3 | Nothing over-engineered: no new framework, middleware layer, roles table or dependency for one rule. | read | M |
| S4 | Both routes are fixed: the edit route and the cover removal. Fixing one and missing the other fails. | read | M |

## 4. Platform

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | The check runs on the server for every request (a server route or server util using the session from `requireUser`), not in a page, a component or client route middleware. | read | M |

## 5. No collateral damage

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | A clean clone installs, migrates, builds and starts with the commands in its README. | run | M |
| C2 | The organizer can still edit their event and remove its cover (both answer 200), and a stranger still can't read the attendee list. (Scripted.) | run | M |
| C3 | The change touches only what the fix needs. Tests and notes are fine; rewrites of unrelated files are not. | read | m |

## 6. Verification

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The agent reproduced the hole before changing the code: a request as a second user, a script or a test that edited someone else's event, or the agent traced it from the code and said so. | log | M |
| V2 | The agent showed the fix works after the change: the same reproduction, or a test it kept in the repo. | log | m |
