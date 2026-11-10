# Findings v5: a harder Meetups, scored 0 to 10

Round of 2026-11-10. Goal from Maxi: frontier models should land around 4 to 5 out of 10 without skills, so skills and the Nuxt MCP have room to add a point or two, and next year's models don't saturate the eval. Harder only where a real reviewer would demand it.

## What changed

- **Meetups v2 is Meetups.** `tasks/meetups`, Workspace `nuxt-evals/meetups`. Old run folders keep their `meetups-v2` ids; `pnpm evals rescore` moved their `project` to `meetups`.
- **Scores are 0 to 10.** A section is its weighted pass rate × 10 (major 3, minor 1, n/a passes, unverified left out). The headline weighs the general sections 65%, the ViteHub sections 25% and Vite Doctor 10%. A run that doesn't build or start scores 0. The old step function (one failed major took a section from 5 to 3) is gone.
- **The judge is blind.** It grades the reference from a folder with a neutral name (`judge-XXXXXX`, not `judge-meetups-v2-reference-…`), with a session log that records no session, and the reference README no longer says "reference" or links the rubric. The old prompt told the judge "this is the reference app".
- **The prompt asks for more.** Passkeys, a cover photo per event, a reminder email the day before, and ViteHub for "photo uploads and background jobs". It stays short and vague.
- **ViteHub weighs 25%, split by primitive.** Six sections: setup, Database, Auth (passkeys included), Email, Blob, Jobs (Queue and Schedule). Every check cites vitehub.dev at the pinned build or ViteHub's code.
- **Vite Doctor is a column and 10% of the headline.** `cli/lib/doctor.ts` runs it on the installed app. Three new rules for X-reply mistakes went to onmax/vite-doctor#315; the eval pins that build.
- **Vibe is a column, outside the headline.** A judge pass on design against anchors in `tasks/meetups/VIBE.md`, comparing with the reference, with cited lines.
- **The model set.** Opus 5.5 medium, Fable 5.2 high, Sol 6.1 xhigh, Luna low (`--agent`).

## The four checks every run failed

| Check | Verdict | What happened |
| --- | --- | --- |
| R10 `process.env` in server code | Real. Every run read `process.env` in server code (all 12 judge evidences quote it). | Moved to Vite Doctor: `nitro/runtime/no-process-env-in-server`. |
| V2 field errors in the app's own words, server repeats every rule | Real and strict. Runs show library defaults ("Too big: expected string to have <=120 characters") or don't repeat the sign-up name rule on the server. | Kept. |
| V5 filters parsed the same on page and API, bad values fall back | Half a rubric bug. It contradicted R4 (invalid input returns 400): most runs failed because their API answered 400 to `?page=abc`. | Rewritten: one shared parser; the page falls back, the API may answer 400. |
| U3 WCAG AA contrast | Real. Nuxt UI's default 500 shades fail on white (error text 3.8:1, `#00DC82` 1.8:1). | Kept. |

## Checks nobody failed

38 of 213 checks were never failed, Luna low included. Mechanical ones moved to Vite Doctor (D1 top-level `$fetch`, H3 `window` in setup, Q1 watch-copies, Q4 timers, Q9 auto-import style, R6 method suffix, R11 aliases, K7 private runtime config). Trivial ones went (P21 brand green visible, P24 free reads as free, D6, D7, D15, S5, S6, H9, R6, A9, C6, T4, X5, X6, U5, Q6, Q10, F1, F4, F7, K1, K6). Sanity checks that matter stayed as minor so they don't carry the score: S2, H10, R14, B4, B5, X1, X2, U4, Y1, Z1.

## What the new features found in ViteHub

- `@vite-hub/schedule` needs `@vite-hub/kv` installed and `vitehub.kv` on. Without the package the server doesn't start (`Could not resolve "@vite-hub/kv" imported by "@vite-hub/schedule"`); without `kv`, it logs `KV_DISABLED` at startup. Neither is in the Schedule docs at 1e807fc.
- On a Node build, `schedule: true` alone fails the build (`VITE_HUB_R0137`); the docs say so, and the reference uses `schedule: { runtime: { driver: "process" } }`.
- The local Queue logs a failed job as `Queue Delivery failed.` with no cause, so the reference logs the provider error itself.
- A Resend send without `RESEND_API_KEY` fails with `EMAIL_PROVIDER_FAILED: Email delivery through unknown failed.`: the message doesn't name the missing key.
- `ensureBlob()` trusts the type the browser declares. The reference also checks the bytes with `detectContentType()`.
- ViteHub Realtime at 1e807fc is Yjs document rooms for collaborative editing, so live seat counts stay on SSE or polling; there is no Realtime section.
- Better Auth's built-in limiter does count per client on Node at this build (3 failed sign-ins from 127.0.0.1 got 429, 127.0.0.2 still got 401, a forged `X-Forwarded-For` didn't escape). The reference's own sign-in limiter, written because "it can't see the client address on plain Node", went.
- Passkeys need a domain: WebAuthn refuses `127.0.0.1` as the relying party, so graders browse at `localhost`. Better Auth's `rpID` defaults to `"localhost"`; the reference sets it from the public URL.

## Numbers

Filled in below once the regrades and the new runs finish.
