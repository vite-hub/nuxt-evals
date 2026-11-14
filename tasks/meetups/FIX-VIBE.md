# Vibe of a fix

A second judge pass, separate from the rubric: how smart the change is. It scores 0 to 10 with one decimal and is shown on its own. It is not part of the headline score.

The agent got a working app with one bug and a user's report of it. Read its change (the patch the prompt names), not the rest of the app: every run starts from the same app. The question is the one a senior Nuxt and ViteHub maintainer asks when the fix lands as a pull request: would I merge this as it is?

- **Smallest change that removes the cause.** One statement, one constraint, one option, at the place the bug lives. A fix that touches ten files for a two-line bug, or moves the problem somewhere else, is not small.
- **Over-engineering.** A new table, queue, lock service, cache layer, wrapper, retry loop or dependency where the platform already had the answer; a framework for one rule; defensive code around the fix that nothing needs.
- **Masking.** A change that hides the symptom (a clamp, a disabled button, a shorter cache, `lazy`, `<ClientOnly>`) while the cause stays.
- **Using the platform.** Nuxt, Nitro, h3, Vue, Better Auth, Drizzle and ViteHub used through their own helpers and options, the way their docs show. A hand-written version of what they give is a reinvented wheel.
- **Proof.** A test or a script that fails before the change and passes after makes a fix easier to merge. A fix nobody ran is harder to trust.
- **Elegance.** The change says what it means; names, the one comment that says why, nothing left over from trying things.

The reference app (in the folder the grader names) has the fix we would write. Compare with it to calibrate, but don't mark down a different fix that is as good. Never score whether the bug is gone here: the rubric's script does that. Only design.

## Anchors

| Score | Means | For example |
| --- | --- | --- |
| 10 | A maintainer would merge it untouched. The smallest change at the cause, through the platform's own tool, with proof. | One conditional SQL statement instead of check-then-insert; `allowQuery` on the cached handler; the ownership helper the other routes use. |
| 8 | Right fix, small. A reviewer asks for a local change: a leftover log, a name, a test it could keep. | The right fix plus a debug line, or without a test. |
| 6 | Fixes the cause but bigger or clumsier than it needs to be. A reviewer asks for a simpler version. | A transaction plus a retry loop where one statement does; a new helper file for a one-line check; the fix copied into routes that didn't need it. |
| 4 | Over-engineered or half-masking. A reviewer blocks on it. | A queue or a lock service to serialize RSVPs; a cache kept but shortened; a new dependency for what the platform has. |
| 2 | Moves the bug or masks it, with a lot of code. | A per-process mutex; a client-only check; a sanitizer instead of a type check. |
| 0 | No meaningful change. | Nothing changed, or only comments and logs. |

Scores between anchors are fine (7.5 when it sits between 6 and 8).

## Evidence

Every finding cites the app's code as `path:line` or `path:line-line`, and says what a reviewer would ask for instead. Name what is elegant too, with its place. A score without cited findings is not accepted.
