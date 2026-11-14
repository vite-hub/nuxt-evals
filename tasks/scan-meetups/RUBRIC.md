# Hidden bugs: scan rubric

How we grade a review of the Meetups app asked for in [PROMPT.md](PROMPT.md). The agent got the app with 12 planted bugs (the plants) among code that looks wrong and is correct (the decoys), and was asked to read it without running it and write `findings.json`. Nothing is built or started: grade from the files. Each check passes, fails, or does not apply (n/a).

Rules for graders:

- A finding matches a plant when its `file` is the plant's file (or a second file the check names), its `line` is within 10 of the planted line or in the same function, and its explanation gives the plant's mechanism in any words. A title alone, or a symptom without the cause, doesn't match. One finding matches at most one plant; a plant counts once.
- Findings after the 25th don't count, for or against.
- A real bug the rubric doesn't list is neither a plant nor noise: it counts for nothing and against nothing. Name it in N1's evidence so a person can confirm it.
- Each check names how to verify it: **read** (the code and findings.json) or **log** (the agent's session log). **M** marks a major check, **m** a minor one.

Gate: G1
Weights: H 37, L 3, E 20, N 25, D 15

A run that fails the gate scores 0. Otherwise sections score as in the Meetups rubric (a major check weighs 3, a minor one 1) and the weights above share the score: recall 40 (H and L), explanation 20 (E), severity order and noise 25 (N), decoys 15 (D). Precision is D plus N1.
---

## 1. Gate

| ID | Check | How | |
| --- | --- | --- | --- |
| G1 | `findings.json` exists at the repo root and parses as a JSON array of objects, each with a string `file`, a number `line`, a `severity` of `critical`, `high`, `medium` or `low`, a string `title` and a string `explanation`. An empty array passes. | read | M |

## 2. Critical and high plants

One check per plant: it passes when a finding matches it. The planted line is in the planted app; quote the matching finding's title in the evidence.

| ID | Check | How | |
| --- | --- | --- | --- |
| H1 | AU7, critical. `server/api/events/[slug]/attendees.get.ts:7`: the attendee list loads the event with `findEventBySlug` after `requireUser`, never checking that the user organizes it, so any signed-in user reads any event's attendee names and emails. The finding says a non-organizer can read the list (a missing ownership check). | read | M |
| H2 | SEC1, critical. `server/api/events/[slug]/index.patch.ts:12` (and the spread at line 17): the edit route reads the raw body with `readBody` and spreads it into `db.update(events).set(...)`, so the caller can set `organizerId`, `slug`, `coverPath` or any column, unvalidated. The finding says the unvalidated body reaches the update (mass assignment, or no validation letting extra fields through). A finding on the validated spread in `index.post.ts` doesn't match. | read | M |
| H3 | KV5, critical. `server/api/events/[slug]/index.get.ts:33` (the `eventPage` cached function, lines 9-33): `defineCachedFunction` keyed by slug only caches `going` and `isOrganizer`, which depend on the user, so for 60 seconds every visitor gets the first visitor's RSVP state and organizer flag. The finding says the cache key omits the user and so serves one user's data to another. | read | M |
| H4 | SSR1, critical. `app/composables/useAuth.ts:10`: `const user = ref(null)` at module scope holds the signed-in user, so on the server every request shares it and one visitor's SSR can render another's name or pass the auth middleware. The finding says the state is shared across requests on the server (cross-request leak); a finding that only mentions a hydration mismatch doesn't match. | read | M |
| H5 | EN2, critical. `nuxt.config.ts:26` (`runtimeConfig.public.rates.apiKey`), with `app/plugins/rates.ts:11` and `.env.example`: the exchange-rates key is public runtime config, sent to every browser in the page payload, and the plugin calls the provider with it. The finding says the key is exposed to the client. A finding that only says the provider is called on every request without a cache doesn't match. | read | M |
| H6 | SEC2, high. `app/pages/sign-in.vue:21` (with `redirectTo` at line 15): `navigateTo(route.query.redirect, { external: true })` follows any absolute URL after sign-in. The finding says it's an open redirect through `?redirect=`. A finding on `sign-up.vue` alone doesn't match. | read | M |
| H7 | BL2, high. `server/api/events/[slug]/cover.put.ts:20` (and the `contentType: file.type` at line 22): `ensureBlob` with `types: ["image"]` admits any declared `image/*` type, SVG included, with no check of the bytes, and the file is served from `/images` on the app's origin with that type. The finding says an SVG (or a file with a forged type) can be uploaded and run script. | read | M |
| H8 | AU5, high. `server/auth.ts:11`: `const origin = requestOrigin \|\| siteUrl` makes the request's Host win over the configured site URL, so Better Auth builds password-reset links (and passkey origins) from an attacker's Host header. The finding says the reset link or base URL follows the Host header (host header injection). | read | M |
| H9 | DB1, high. `server/api/events/[slug]/rsvp.post.ts:23` (with `seatsLeft` in `server/utils/events.ts`, no longer clamped): the route awaits the free-seat count, then inserts, so two concurrent RSVPs both pass and the event oversells. The finding says it's a race between the check and the insert. | read | M |
| H10 | Q1, high. `server/utils/mail.ts:53`, in `sendRsvpMail`: the `email.send` error is only logged; the sent-at claim stays set and the queue job succeeds, so a failed confirmation or reminder is never retried. The finding is about the RSVP mails (not the password reset at line 59) and says the error is swallowed so the job isn't retried or the claim isn't released. | read | M |

## 3. Medium and low plants

| ID | Check | How | |
| --- | --- | --- | --- |
| L1 | SEC8, medium. `server/api/events/[slug]/attendees.csv.get.ts:6`: `csvField` quotes cells but doesn't defuse values starting with `=`, `+`, `-`, `@`, tab or carriage return, so an attendee's name runs as a formula in a spreadsheet. The finding says CSV or formula injection. | read | m |
| L2 | DB9, low. `server/api/events/index.get.ts:16`: `lower(events.city) = lower(?)` puts a function on the column, so `events_city_starts_at_idx` can't serve the city filter. The finding says the index isn't used (a full scan). | read | m |

## 4. Explanations

Graded over the plants matched in sections 2 and 3. Each check fails when no plant matched.

| ID | Check | How | |
| --- | --- | --- | --- |
| E1 | For at least three quarters of the matched plants, the explanation says what goes wrong and its effect on people or data (whose data leaks, what gets oversold or lost). | read | M |
| E2 | For at least three quarters of the matched plants, the explanation says how it's triggered: the request, input, header or timing that causes it. | read | M |
| E3 | For at least three quarters of the matched plants, the explanation gives a fix that would work in this app, not one that masks it (clamping the shown seats, rotating the key, hiding a button, a per-process lock, stripping `<script>` from SVGs). | read | M |

## 5. Severity order and noise

| ID | Check | How | |
| --- | --- | --- | --- |
| N1 | At most three of the first 25 findings are noise: findings that match no plant, aren't a decoy (section 6 grades those) and aren't a real bug in this code, such as style nits, speculation the code rules out, or problems in code that doesn't exist. List the noise findings and any real unlisted bugs in the evidence. | read | M |
| N2 | Matched critical and high plants (section 2) come before matched medium and low plants (section 3) in the array; when no medium or low plant matched, they come before every finding the agent rated medium or low. Fails when no critical or high plant matched. | read | M |
| N3 | Each matched plant's `severity` is within one tier of the plant's (critical and high are one tier apart, critical and medium two). Fails when no plant matched. | read | m |

## 6. Decoys

Each check passes when no finding calls this correct code a bug. A finding on the same lines about a different, real problem doesn't fail it.

| ID | Check | How | |
| --- | --- | --- | --- |
| D1 | DC1. `server/api/events/index.post.ts:11-19` spreads `input` into the insert. It comes from `readValidatedBody(event, newEventSchema)`, a `z.object` that drops unknown keys, and `organizerId` is set after the spread. No finding calls it mass assignment. | read | m |
| D2 | DC2. `app/pages/sign-up.vue:19`: `navigateTo(String(route.query.redirect \|\| "/"))` without `external`. Nuxt's `navigateTo` throws `NUXT_E2001` for absolute URLs and for `//x` and `/\x` unless `external` is set, so it can't leave the site. No finding calls it an open redirect. | read | m |
| D3 | DC3. `server/api/events/index.get.ts:19-21`: the `LIKE ${containing(q)} ESCAPE '\\'` values sit in Drizzle's `sql` template, so they are bound parameters, and `containing` escapes `%`, `_` and `\`. No finding calls it SQL injection. | read | m |
| D4 | DC4. The JSON POST, PATCH and DELETE routes take no CSRF token. Better Auth's session cookie is `SameSite=Lax`, so a cross-site form or fetch carries no session. No finding calls them open to CSRF. | read | m |
| D5 | DC6. `server/api/events/[slug]/seats.get.ts` needs no sign-in. Seat counts are public on the event page and hold no personal data. No finding calls it missing authentication. | read | m |
| D6 | DC7. `findOwnedEvent` in `server/utils/events.ts:12-16` answers 404, not 403, to someone who isn't the organizer. That is deliberate: it doesn't confirm the event exists to a stranger. No finding calls the status wrong. | read | m |
| D7 | DC8. `sendPasswordReset` in `server/utils/mail.ts` sends the reset mail inline instead of through the Queue. A queued job would store the reset token in the queue. No finding says it must be queued. | read | m |
| D8 | DC10. `server/api/events/index.post.ts:12`: `requireRateLimit` runs after the body is validated, so a form with mistakes doesn't use up the quota. No finding calls the order a bug. | read | m |
| D9 | DC11. `server/api/events/[slug]/cover.put.ts:26-33`: after the conditional swap, `blob.del` removes the old cover (or the new one when the swap lost). Once the row points at the new path the old object is an orphan. No finding calls it data loss. | read | m |
| D10 | DC13. `server/api/events/[slug]/index.get.ts`: `started` is computed from `Date.now()` in the API handler, outside the cache. The server decides it and the payload carries it to the client. No finding calls it a hydration mismatch. | read | m |
| D11 | DC15. `app/composables/useCurrency.ts:2`: `useState("locale", ...)` with a fixed key. `useState` is per request on the server. No finding calls it a cross-request leak. | read | m |
| D12 | DC21. `sendPasswordReset` at `server/utils/mail.ts:59` logs a failed send and doesn't throw. Deliberate: the response doesn't wait on or reveal the send, and the visitor can ask again. No finding says the reset mail's error must be thrown or retried (a finding on `sendRsvpMail` at line 53 is plant H10, not this). | read | m |
