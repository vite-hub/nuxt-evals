# Seats oversold: fix rubric

How we grade a fix of the report in [PROMPT.md](PROMPT.md). The agent got the Meetups app with the RSVP route rewritten as check-then-insert: it reads the free seats, awaits, then inserts. Two requests that both read a free seat both insert, so an event oversells and its seats left go below zero. Each check passes, fails, or does not apply (n/a).

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
| F1 | Thirty signed-up visitors RSVP at once to a 12-seat event, three times over: every time exactly 12 RSVPs and 0 seats left, never fewer than 0. | run | M |

## 2. Root cause

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | The agent's final message names the cause: the route reads the free seats, waits, then inserts, so two requests both see a free seat and both insert (a check-then-act race). A message that only says "seats can go negative" or blames the display fails. | log | M |
| R2 | The change is in the RSVP route or the seat count it relies on, not only in how seats are shown. | read | m |

## 3. Solution

Ranked solutions we know:

- **Best:** one conditional statement, `INSERT … SELECT … WHERE (SELECT count(*) …) < capacity ON CONFLICT DO NOTHING RETURNING`: the database checks and inserts at once.
- **Acceptable:** a seat counter, `UPDATE events SET taken = taken + 1 WHERE taken < capacity RETURNING`, with the insert in the same batch; a `BEFORE INSERT` trigger that aborts when the event is full; a SQLite or libSQL write transaction (`BEGIN IMMEDIATE`), which works here but not on D1.
- **Over-engineered:** a queue with concurrency 1 per event, a Durable Object, a KV lock, a new table of seat tokens.
- **Masks the symptom:** clamping the shown number at 0, disabling the button.
- **Wrong:** an in-memory mutex or lock per event: it holds in one server process, not on a host with several (Cloudflare, Vercel, two Node processes on libSQL). The script runs one process, so S4 catches this by reading the code.

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | The fix is the best solution or an acceptable one from the list above (or a novel one as sound). | read | M |
| S2 | The fix is the best one: the seat check and the insert happen in one database statement, or the database itself enforces the limit. | read | M |
| S3 | Nothing over-engineered: no queue, lock service, Durable Object, KV lock, new table or new dependency to serialize RSVPs. | read | M |
| S4 | No masking: the change doesn't stop at clamping the number, disabling the button, or a per-process mutex. | read | M |

## 4. Platform

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | The fix goes through the app's own database access (`db` from `vite-hub/database/drizzle`, Drizzle's `sql` or query builder), with no second client, raw driver or ORM. | read | M |

## 5. No collateral damage

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | A clean clone installs, migrates, builds and starts with the commands in its README. | run | M |
| C2 | One visitor RSVPing three times at once still ends with exactly one RSVP, and every answer says they're going. (Scripted.) | run | m |
| C3 | The change touches only what the fix needs. Tests, notes and a migration the fix needs are fine; rewrites of unrelated files are not. | read | m |

## 6. Verification

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The agent reproduced the race before changing the code: concurrent requests, a script or a test that showed more RSVPs than seats, or the agent reasoned it through from the code and said so. | log | M |
| V2 | The agent showed the fix works after the change: the same reproduction, or a test it kept in the repo. | log | m |
