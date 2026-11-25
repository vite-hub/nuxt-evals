# Research

Read in this order:

1. [plan-v2.md](plan-v2.md): the current plan, with Maxi's decisions from the Drop review. It replaces plan-v1.
2. [findings-v6.md](findings-v6.md): Meal planner, a Vue-only project: v1 too easy (Opus 9.0), v2 harder (Opus 8.2), harness made per-project, what it would take to reach 5.
3. [findings-v5.md](findings-v5.md): Meetups made harder (passkeys, covers, reminders), scores from 0 to 10, a blind judge, ViteHub split by primitive, Vite Doctor and vibe columns, and before/after numbers.
4. [findings-v4.md](findings-v4.md): the harder Meetups (39 probes), Sol 6.1 xhigh calibration, setups B and C, Nuxt 5 and audit traps.
5. [findings-v3.md](findings-v3.md): one Agent with the harness as a field, cost, a Workspace ref per run, the Meetups project, Codex sandbox traps.
6. [findings-v2.md](findings-v2.md): the flow (local CLI, native session files, `importAgentSession`), harness traps, the audit.
7. [findings-v1.md](findings-v1.md): Content summaries, Console access, the ViteHub gaps table, pnpm and pkg.pr.new traps.
8. [findings-v0.md](findings-v0.md): what the first end-to-end runs showed, ViteHub gaps, event shapes, token numbers.
9. [prior-art.md](prior-art.md): other eval suites (nuxt-evals, next-evals, Laravel Boost, svelte-evals, SWE-bench) and judge bias.
10. [vitehub-primitives-audit.md](vitehub-primitives-audit.md): which ViteHub primitives fit, as of origin/main 4763b4fba.
11. [local-tooling-facts.md](local-tooling-facts.md): Nuxt 5 versions, nuxt-skills state, vite-doctor, CLIProxy, isolation leaks.
12. [plan-v1.md](plan-v1.md): the first plan, kept for its full prior-art tables and task catalog.

Next eval types, 2026-11-14: [corpus/corpus-v0.md](corpus/corpus-v0.md) is the merged corpus for fix evals (Type A: one planted bug, perf issue or migration, ranked solutions) and hidden-bug evals (Type B: static scan with plants and decoys). Four council files (`corpus/council-*.md`) feed it; the briefs that produced them sit beside them. Reviews on Drop (private, they hold the answer keys): [fix evals](https://drop.vitehub.dev/d/yke0arpdfy1p/fix-evals-corpus), [hidden-bug evals](https://drop.vitehub.dev/d/4gqjp63p3s0n/hidden-bug-evals-corpus).

Plan review on Drop: https://drop.vitehub.dev/d/0yy3jzkt9phd/nuxt-agent-evals-plan (private).
