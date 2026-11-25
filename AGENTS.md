# nuxt-evals

The project ended on 2026-11-24 (see the site's /timeline). Don't start agent or judge runs. Keep the site, its results and the methodology online; site fixes are fine.

Evals that measure whether Nuxt agent tooling (Nuxt MCP, core skills, nuxt-skills plugin) makes Codex and Claude Code write better Nuxt 5 / Nitro v3 / h3 v2 code. Read [README.md](README.md) for the flow, then `research/` before you change the design:

- `research/plan-v2.md`: the current plan and Maxi's decisions. It wins over `plan-v1.md`.
- `research/findings-v0.md`: what the first end-to-end runs showed, and the ViteHub gaps they found.
- `research/prior-art.md`, `research/vitehub-primitives-audit.md`, `research/local-tooling-facts.md`: research from 2026-11-07. Check a fact again before you rely on it.

Rules:

- Grade outcomes and code quality. Never grade file layout. Accept every correct form of a primitive.
- Probes and tasks come from Nuxt docs, never from the skills under test.
- Keep isolation in ViteHub configuration (Agent and Sandbox options) and check it after each run. If ViteHub leaks or lacks something, fix it with `pnpm patch` here and upstream it to vite-hub/vitehub.
- Nuxt 5, Nitro v3 and h3 v2 only.
- Runs cost tokens. Start with one run, read it, then scale.
