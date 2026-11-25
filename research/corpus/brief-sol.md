# Brief: corpus for two new nuxt-evals eval types

You are one of three council members (Claude Opus, GPT Sol, Grok), each working independently on the same request. Research only: do not edit code outside your own output file, do not open issues, PRs or comments anywhere, do not push.

## Context

`/home/maxi/vitehub/nuxt-evals` measures whether Nuxt agent tooling makes Codex and Claude Code write better Nuxt 5 / Nitro v3 / h3 v2 + ViteHub code. Read `AGENTS.md`, `README.md`, `research/plan-v2.md` and `research/findings-v6.md` first (15 minutes, not more). Today's evals are greenfield: the agent builds an app from an empty folder (Meetups, `tasks/meetups/PROMPT.md`, reference app in `tasks/meetups/reference/`; Meal planner, Vue only). Maxi thinks that covers about 5% of what users actually ask agents to do.

ViteHub (vitehub.dev) is the primitives layer under test: Database (Drizzle, SQLite/libSQL/D1), Auth (Better Auth), Blob, KV, Queue, Workflow, Schedule, Email, Realtime (Yjs), Content, Agent, Sandbox, Workspace, Rate-limit, Env, Connections, Channels, Browser, UI, the Console, Vite Doctor rules. Source: `/home/maxi/vitehub/vitehub` (`packages/*`, `docs/content/docs/**`, `git log`, `AGENTS.md`). `research/vitehub-primitives-audit.md` maps the packages.

Real apps built on ViteHub, with their git history (mine them for real bugs, perf issues and the commits that fixed them):
`/home/maxi/vitehub/{drop,calories,email-labeller,babysitter,strata,joxi,nuxt-agent,bitacora-agent,console}` and the nuxt-evals `site/` itself. `git -C <repo> log --oneline -i --grep='fix\|perf\|slow\|race\|leak\|n+1\|cache'` is a good start; `git show <sha>` gives the before/after.

`gh` is authenticated: read issues and PRs (`gh search issues`, `gh issue view`, `gh api`) on vite-hub/vitehub, nuxt/nuxt, nitrojs/nitro, h3js/h3, vuejs/core, unjs/*, better-auth/better-auth, drizzle-team/drizzle-orm, nuxt-hub/core (NuxtHub, ViteHub's ancestor). Read only.

## Maxi's request (paraphrased, keep its intent)

Two new eval types.

**A. Known-issue fix evals.** A fixture app (existing Meetups reference, Meal planner, the email labeller, a new small app, or one huge app) has a planted bug, performance problem, security hole or legacy code to migrate. The agent gets a user-style report ("seats left goes negative when two people RSVP at once", "the event page takes 4s", "move this 3-year-old NuxtHub/Nuxt 3 code to ViteHub"), no skills, and must find the cause and fix it, and the fix must run. Maxi cares beyond "it works": did it find the real root cause, is the fix the smart one or over-engineered, does it use the right ViteHub primitive/API instead of hand-rolling, how much time and how many tokens. Each case needs a **corpus of solutions**: for one problem there can be 5+ fixes; rank them (best / acceptable / over-engineered / wrong-or-masking), so an agent's fix can be matched to a known solution or flagged as novel. Classes Maxi named: bugs, performance, migrations of old code written before the APIs existed, ViteHub-specific "nooks" (the corners only ViteHub has). He's open to 50, 100, 300 cases; start with ~20 varieties. Example he gave: a "Vue portal" issue about session performance (unclear which; if you find a likely match in the ViteHub or app history, say so).

**B. Hidden-bug static detection evals.** Real apps carry bugs nobody has found yet. Plant several in a fixture and ask the agent to scan the repo statically (no running) and report them. Graded on recall, precision (false positives cost), severity ranking, and whether the explanation is right.

Goal of this research: the corpus and the reasoning about *why* these bugs appear (what in Nuxt/Nitro/h3/ViteHub makes them easy to write).

## Your lens

The ecosystem and migrations. Real bugs from issue trackers and real projects in Nuxt 5/4/3, Nitro v3, h3 v2, Vue 3, Better Auth, Drizzle, NuxtHub (useFetch/useAsyncData keys and dedupe, SSR state leaks, hydration mismatches, payload bloat, cache handlers, route rules, server middleware order, h3 v2 breaking changes, Nitro tasks). And migration cases: code written 1-3 years ago before an API existed (NuxtHub hubDatabase/hubKV/hubBlob to ViteHub, Nuxt 3 to 5, h3 v1 to v2, Nitro v2 to v3, hand-rolled auth/session/upload/cron/queue to the ViteHub primitive). Explain for each why the bug class appears.

Cover the other classes too, but spend most of your effort on your lens.

## Output

Write one Markdown file: `/home/maxi/vitehub/nuxt-evals/research/corpus/council-sol.md`. Aim for 30-45 cases. Every case uses this shape (keep it tight, no padding):

```
### <id> <short title>
- Type: A (fix) | B (hidden) | both · Class: bug | perf | security | migration | nook | dx · Primitive(s): ...
- Fixture: which app, where it is planted (file/area), how big the plant is
- Report given to the agent (A only): the user's words, vague like a real user
- Root cause: one or two sentences
- Why it gets written: what in the API/docs/defaults makes it easy (this matters)
- Verification: the deterministic check that proves the fix (test, probe, load script, query count, bundle size, timing)
- Solutions: 3-6 ranked, each one line: [best|acceptable|over-engineered|masks-symptom|wrong] what it does · why
- Agent traps: what an agent will likely do wrong
- Evidence: real commit sha + repo, issue/PR URL, or "synthetic" (prefer real; say which are real)
- Difficulty: 1-5 · Static-detectable: yes/no/partly
```

Before the cases, a short section (under 400 words) with: your proposed scoring dimensions and weights for A and for B (root cause, solution class match, minimality/over-engineering, primitive use, verification, regressions, time, tokens, cost; for B: recall, precision, severity, explanation), how to grade solution match (rubric + judge vs. hidden tests), and which fixture strategy you recommend (reuse Meetups reference vs. new apps vs. one huge app). After the cases, list the 20 you'd build first and why, and the open questions for Maxi.

Mark every fact you checked with its source. Mark guesses as guesses. Say which ViteHub APIs you verified exist in `/home/maxi/vitehub/vitehub` (path:line) — do not invent APIs.

## Machine rules (shared machine, 15-25 agents)

- Search only inside named project folders with `rg` or `fdfind`. Never search from `~`, `/home/maxi` or `..`.
- Don't install, build or run test suites. If you must, prefix with `heavy` (e.g. `heavy pnpm vitest run <file>`), one file at a time.
- No dev servers. No `git stash`. Don't change branches or files in any repo except your output file.
