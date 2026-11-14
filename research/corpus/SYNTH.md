# Synthesis brief: merge the council into one corpus

Read `BRIEF.md` in this folder (the request the council answered), then the four council files: `council-opus.md` (ViteHub history), `council-sol.md` (ecosystem + migrations), `council-grok.md` (hidden-bug seat; it ran on Opus because Grok's balance ran out), `council-fable.md` (eval design, perf, change tasks). About 160 cases with heavy overlap (the seat race appears in all four, for example).

Write `/home/maxi/vitehub/nuxt-evals/research/corpus/corpus-v0.md`, the canonical corpus. Your only write.

## Rules

1. **Dedupe.** One canonical case per root cause. Merge the solution lists (keep every distinct solution, re-rank as one list: best / acceptable / over-engineered / masks-symptom / wrong), merge the traps and evidence, keep the strongest verification. Record which seat ids it came from (`from: opus DB1 · sol SOL-35 · grok C01 · fable P-03`). Two cases with the same symptom but different root causes stay separate.
2. **IDs.** New ids, one prefix per family, no prefix starting another: `Q` queue/workflow/schedule, `BL` blob, `AU` auth/session, `DB` database, `KV` kv/cache, `RL` rate-limit, `RT` realtime, `AG` agent/workspace/sandbox, `EN` env/config, `PF` performance (non-primitive), `SSR` Nuxt rendering/state/hydration, `SEC` security not covered above, `MG` migrations, `CH` change tasks (feature, refactor, review, not-a-bug). Hidden-bug plant pool: `HB` plants, `DC` decoys. A case that is both a fix task and a plant keeps its fix id and is listed in the plant pool by that id.
3. **Admission.** Keep a case only if it has a deterministic verification. Cut ones that are pure opinion or that only test ViteHub's own bugs (a fixture bug must live in app code at the fixture's pinned ViteHub version). List cut cases at the end with the reason, one line each.
4. **Verify the load-bearing claims** against source (`/home/maxi/vitehub/vitehub`, the reference at `/home/maxi/vitehub/nuxt-evals/tasks/meetups/reference`, the ViteHub apps under `/home/maxi/vitehub/`). At minimum: (a) Queue `idempotencyKey` refused on Cloudflare at the reference's pinned ViteHub, and the reference only logs it, so confirmation emails never send on Workers; (b) Nitro v3 cached handlers ignore query by default; (c) `navigateTo` external block and its error message; (d) Blob `types: ["image"]` admits SVG; (e) KV `setIfAbsent` unsupported on Cloudflare KV; (f) the "Vue portal" candidates vitehub #4054, #4044, #2692, #4001 (`gh pr view`), pick the best match; (g) Meetups `cover.put.ts` buffers the whole form before the size check (already confirmed by me: it calls `event.req.formData()` before `ensureBlob`). Mark each claim `verified (path:line)`, `refuted`, or `unverified` in the case. Where seats disagree on a fact, say so and resolve it.
5. **Why taxonomy.** Merge the seats' "why it gets written" causes (Opus's six patterns, Fable's W1-W12) into one list of at most 12 causes with ids `W1..`. Tag every case with one or two.
6. **Design.** Merge the scoring proposals into one recommended scoring for Type A and one for Type B, and list where the seats disagree (weights, huge app vs. several fixtures, web access, Vite Doctor access, judge vs. hidden tests). Give your recommendation on each disagreement with the reason.
7. **First 20.** Merge the four "build first" lists into one ranked list of 20 Type A cases, with how many seats picked each. Then the Type B starter fixture: plant ids and decoy ids.

## Shape of corpus-v0.md

1. Header: counts per family, per class, per evidence (real vs. synthetic), per fixture.
2. Why taxonomy (W ids).
3. Design: scoring A, scoring B, solution matching, fixture strategy, leak controls, disagreements with recommendations.
4. Index table: id · title · class · primitive · fixture · difficulty · evidence (real/synthetic) · W tags · from.
5. Cases, grouped by family, in the case shape from BRIEF.md plus `From:` and `Why: W..`.
6. Hidden-bug pool: plants (HB + fix ids) with severity, file area, static signal; decoys (DC) with why each is correct and what it looks like.
7. First 20 + Type B starter.
8. Open questions for Maxi (merged, deduped, at most 12).
9. Cut cases.

Write plainly: short sentences, no filler. Keep the cases tight; a case runs 10-18 lines. Don't drop real evidence (sha, PR URL) when merging.

Machine rules: search only inside the named folders with `rg`/`fdfind`, never from `~` or `/home/maxi`. No installs, builds, test suites or dev servers. No `git stash`, no branch changes. Read-only `gh` is fine; post nothing.
