# nuxt-evals

Do the Nuxt MCP, the core Nuxt skills and the nuxt-skills plugin make coding agents write better Nuxt 5 / Nitro v3 / h3 v2 code? This repo runs agents on tasks, grades what they wrote, and publishes the results at [nuxt-evals.onmax.me](https://nuxt-evals.onmax.me).

Status: **pilot.** Project 1 (Meetups, `tasks/meetups`), Codex (`gpt-6-luna`, low effort), setup A (bare). The design is in [research/plan-v2.md](research/plan-v2.md).

## How a run flows

Agents don't run on the server. They run on your machine (or a runner), and the site imports what they recorded.

1. `pnpm evals run <project>` copies `tasks/<project>/fixture` into a fresh Git working copy in a temp folder, with an empty HOME elsewhere, and runs the agent's own CLI there (`codex exec` or `claude -p`) through CLIProxy.
2. It keeps the agent's **native session file**, the diff and the files, grades the probes, audits what the agent was offered, prices the tokens from models.dev list prices, and writes an Opus 5.5 summary. Everything lands in `cli/.data/runs/<id>/`, with ids like `20261107-1612-meetups-codex-a1`.
3. `pnpm evals push <id|all>` sends a run to the site. `pnpm evals base <project>` sends the starting app, the prompt and the probes, which `/projects/<project>` shows.
4. `site/` (Nuxt 5 on Cloudflare Workers) keeps the row in D1, the raw session in Blob, the summary in ViteHub Content, and the working copy in the project's ViteHub Workspace (`server/workspaces/meetups.ts`): ref `main` is the starting app, and each run commits its files to a ref named after the run. A run records the `main` revision it started from, so a newer starting app does not change older diffs. It imports the session into its Agent journal with `importAgentSession()` from `@vite-hub/agent/sessions` (a pnpm patch). Every session belongs to one Agent, `coding-agent`; the harness (Codex or Claude Code), model and setup are fields of the session. The public Console shows the prompt, notes, thinking, every command with its output, file changes as diffs, the skills the agent had, usage and cost, and the session's Workspace revision.

## Run it

```sh
pnpm install
cp cli/.env.example cli/.env          # fill CLIPROXY_API_KEY and INGEST_TOKEN
pnpm evals run meetups --repeat 3 --parallel 3      # Codex, setup A, three sessions at once
pnpm evals run meetups --harness claude-code
pnpm evals list
pnpm evals push all
pnpm evals base meetups                             # the starting app, prompt and probes for /projects/meetups
pnpm evals reset --yes                              # deletes every run on SITE_URL
```

Other flags: `--model`, `--reasoning`, `--no-summary`. `pnpm evals summarize <id|all>` rewrites summaries.

Site locally: `pnpm dev:site` (http://127.0.0.1:4791). Apply the local migrations once with `pnpm --filter site exec vitehub db migrate`; push to it with `SITE_URL=http://localhost:4791`.

## Deploy

A push to `main` deploys `site/` through Cloudflare Workers Builds, connected to this repository on the `nuxt-evals` Worker (Settings > Builds). GitHub Actions does not deploy. Build command `pnpm --filter site build`, deploy command `pnpm --filter site release` (D1 migrations, then `wrangler deploy --config .output/server/wrangler.json`), build variables `NODE_VERSION=24` and `PNPM_VERSION=11.18.0`. The Worker needs the secret `NUXT_INGEST_TOKEN`; the CLI sends the same value as `INGEST_TOKEN`.

## Layout

| Path | What |
| --- | --- |
| `research/` | Plans, research reports, the Discord thread, and findings. Start here. |
| `tasks/` | Task prompts, fixtures and probes. |
| `cli/` | Runs agent CLIs, grades and stores runs, pushes them. Node only. |
| `site/` | Results site and public Console on Cloudflare. |
| `patches/` | pnpm patches on ViteHub, each written up for upstream. `patches/src/` holds the sources of new files. |
