# nuxt-evals

Do the Nuxt MCP, the core Nuxt skills and the nuxt-skills plugin make coding agents write better Nuxt 5 / Nitro v3 / h3 v2 code? This repo runs agents on tasks, grades what they wrote, and publishes the results at [nuxt-evals.onmax.me](https://nuxt-evals.onmax.me).

Status: **dummy data.** One toy task, Codex (`gpt-6-luna`, low effort) and Claude Code, setup A (bare). It exists to prove the flow end to end. The real design is in [research/plan-v2.md](research/plan-v2.md).

## How a run flows

Agents don't run on the server. They run on your machine (or a runner), and the site imports what they recorded.

1. `pnpm evals run <task>` copies `tasks/<task>/fixture` into a fresh Git working copy in a temp folder, with an empty HOME elsewhere, and runs the agent's own CLI there (`codex exec` or `claude -p`) through CLIProxy.
2. It keeps the agent's **native session file**, the diff and the files, grades the probes, audits what the agent was offered, and writes an Opus 5.5 summary. Everything lands in `cli/.data/runs/<id>/`.
3. `pnpm evals push <id|all>` sends a run to the site.
4. `site/` (Nuxt 5 on Cloudflare Workers) keeps the row in D1, the raw session and the workspace in R2, the summary in ViteHub Content, and imports the session into its Agent journal with `importAgentSession()` from `@vite-hub/agent/sessions` (a pnpm patch). The public Console shows each run as an Agent session: the prompt, notes, thinking, every command with its output, file changes as diffs, usage and the real timing.

## Run it

```sh
pnpm install
cp cli/.env.example cli/.env          # fill CLIPROXY_API_KEY and INGEST_TOKEN
pnpm evals run contact-endpoint                      # Codex, setup A
pnpm evals run contact-endpoint --agent claude-code --repeat 2
pnpm evals list
pnpm evals push all
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
