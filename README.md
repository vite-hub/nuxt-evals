# nuxt-evals

Do the Nuxt MCP, the core Nuxt skills and the nuxt-skills plugin make coding agents write better Nuxt 5 / Nitro v3 / h3 v2 code? This repo runs agents on tasks, grades what they wrote, and publishes the results at [nuxt-evals.onmax.me](https://nuxt-evals.onmax.me).

Status: **pilot.** The current project is Meetups v2 (`tasks/meetups-v2`): the agent starts in an empty folder with a short, vague prompt, and an Opus 5.5 judge grades the app against a 194-check rubric (`RUBRIC.md`), next to a reference app built with Nuxt 5 and ViteHub (`reference/`). Meetups v1 (`tasks/meetups`, a starting app and probes) stays on the site as history. The design is in [research/plan-v2.md](research/plan-v2.md).

## How a run flows

Agents don't run on the server. They run on your machine (or a runner), and the site imports what they recorded.

1. `pnpm evals run <project>` copies `tasks/<project>/fixture` (or nothing, for a project without one) into a fresh Git working copy in a temp folder, with an empty HOME elsewhere, and runs the agent's own CLI there (`codex exec` or `claude -p`) through CLIProxy.
2. It keeps the agent's **native session file**, the diff and the files, grades the probes, audits what the agent was offered, prices the tokens from models.dev list prices, and writes an Opus 5.5 summary. Everything lands in `cli/.data/runs/<id>/`, with ids like `20261107-1612-meetups-codex-a1`.
   Rubric projects (Meetups v2) are graded by the judge instead of probes (`cli/lib/judge.ts`). It runs Claude Code with Opus 5.5 through CLIProxy, so it uses the Claude subscription, with an empty Claude config. One session installs, builds and starts the app as its README says and grades P1 and P3; the CLI then starts the production server once; four sessions grade the other sections against the running app and the code, with evidence for every check. The CLI turns the outcomes into section scores with the rubric's rules (`site/shared/rubric.ts`), so the judge never picks a score. The grade goes into `run.json` as `rubric`, and `score` becomes the mean over 5. `pnpm evals judge reference` grades the reference app the same way, into `tasks/meetups-v2/reference-grade.json`.
3. `pnpm evals push <id|all>` sends a run to the site. `pnpm evals base <project>` sends the starting app, the prompt and the probes, which `/projects/<project>` shows.
4. `site/` (Nuxt 5 on Cloudflare Workers) keeps the row in D1, the raw session in Blob, the summary in ViteHub Content, and the working copy in the project's ViteHub Workspace (`server/workspaces/meetups.ts`): ref `main` is the starting app, and each run commits its files to a ref named after the run. A run records the `main` revision it started from, so a newer starting app does not change older diffs. It imports the session into its Agent journal with `importAgentSession()` from `@vite-hub/agent/sessions` (a pnpm patch). Every session belongs to one Agent, `coding-agent`; the harness (Codex or Claude Code), model and setup are fields of the session. The public Console shows the prompt, notes, thinking, every command with its output, file changes as diffs, the skills the agent had, usage and cost, and the session's Workspace revision. The run page and the project page have a **Preview** tab: it runs that working copy in the reader's browser with `@vite-hub/web-container` (`npm install`, the service stand-ins on port 4799, then `nuxt dev`), about 2.5 minutes the first time. Those two pages send `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy: credentialless` for it.

## Run it

```sh
pnpm install
cp cli/.env.example cli/.env          # fill CLIPROXY_API_KEY and INGEST_TOKEN
pnpm evals run meetups-v2 --repeat 3 --parallel 3   # Codex, setup A, three sessions at once, then the judge
pnpm evals run meetups-v2 --harness claude-code
pnpm evals judge <id|all>                           # grade saved Meetups v2 runs again
pnpm evals judge reference                          # grade the reference app (the yardstick)
pnpm evals list
pnpm evals push all
pnpm evals base meetups-v2                          # prompt, rubric, reference app and its grade for /projects/meetups-v2
pnpm evals reset --yes                              # deletes every run on SITE_URL
```

Other flags: `--model`, `--reasoning`, `--no-summary`, `--no-judge`. `pnpm evals summarize <id|all>` rewrites summaries.

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
