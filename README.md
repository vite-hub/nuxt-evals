<h1>
  <img src="./.github/banner.svg" alt="nuxt-evals: grading the Nuxt code that coding agents write" width="100%">
</h1>

[![results](https://comark-ui.onmax.me/badge.svg?label=results&value=nuxt-evals.onmax.me)](https://nuxt-evals.onmax.me)
[![status](https://comark-ui.onmax.me/badge.svg?label=status&value=pilot)](#how-a-run-flows)
[![stack](https://comark-ui.onmax.me/badge.svg?label=stack&value=Nuxt%205%20%C2%B7%20Nitro%20v3%20%C2%B7%20h3%20v2)](https://nuxt.com)

Do the Nuxt MCP, the core Nuxt skills and the nuxt-skills plugin make coding agents write better Nuxt 5 / Nitro v3 / h3 v2 code? This repo runs agents on tasks, grades what they wrote, and publishes the results at [nuxt-evals.onmax.me](https://nuxt-evals.onmax.me).

[Results](https://nuxt-evals.onmax.me) · [Methodology](https://nuxt-evals.onmax.me/methodology) · [How a run flows](#how-a-run-flows) · [Run it](#run-it) · [Plan](research/plan-v2.md)

An independent project by [@onmax](https://github.com/onmax).

Status: **pilot.** Two projects. Meal planner (`tasks/meal-planner`) is a Vue 3 + Vue Router 5 app with no backend, graded by the same judge on its own rubric; the agent starts with only the recipe data. The first project is Meetups (`tasks/meetups`): the agent starts in an empty folder with a short, vague prompt that asks for Nuxt nightly and ViteHub, and an Opus 5.5 judge grades the app against a 219-check rubric (`RUBRIC.md`), next to a reference app built with Nuxt 5 and ViteHub (`reference/`). Each run scores 0 to 10: 65% general sections, 25% the six ViteHub sections, 10% [Vite Doctor](https://vite-doctor.onmax.me). A separate vibe pass (`VIBE.md`) scores the design and is shown beside it. The design is in [research/plan-v2.md](research/plan-v2.md); this round's changes and numbers are in [research/findings-v5.md](research/findings-v5.md).

## How a run flows

Agents don't run on the server. They run on your machine (or a runner), and the site imports what they recorded.

1. `pnpm evals run <project>` copies `tasks/<project>/fixture` (or nothing, for a project without one) into a fresh Git working copy in a temp folder, with an empty HOME elsewhere, and runs the agent's own CLI there (`codex exec` or `claude -p`) through CLIProxy.
2. It keeps the agent's **native session file**, the diff and the files, grades the probes, audits what the agent was offered, prices the tokens from models.dev list prices, and writes an Opus 5.5 summary. Everything lands in `cli/.data/runs/<id>/`, with ids like `20261111-0900-meetups-opus-a2` (the agent's name from the model set, or its model id).
   Rubric projects (Meetups) are graded by the judge instead of probes (`cli/lib/judge.ts`). It runs Claude Code with Opus 5.5 through CLIProxy, so it uses the Claude subscription, with an empty Claude config. One session installs, builds and starts the app as its README says and grades P1 and P3; the CLI then starts the production server once; grading sessions, three at a time, grade the other sections against the running app and the code, with evidence for every check. The CLI turns the outcomes into scores from 0 to 10 with the rubric's rules (`site/shared/rubric.ts`), so the judge never picks a score. The grade goes into `run.json` as `rubric`, and `score` becomes the headline over 10. `pnpm evals judge reference` grades the reference app the same way, into `tasks/meetups/reference-grade.json`. The judge is blind: the reference is graded from a folder with a neutral name, with a session log that records no session, so nothing tells it which app it has. After the setup session, the CLI runs Vite Doctor (`cli/lib/doctor.ts`, JSON report) on the installed app and scores it against the rules the reference app fires; the build it runs is `vite-doctor` in `cli/package.json`, or `VITE_DOCTOR_CLI`. A vibe session reads the code against `tasks/meetups/VIBE.md` and the reference app. After a grade, an explain step (`cli/lib/explain.ts`) reads the code again, without running it, and adds to each failed check the lines it is about and a fix; for the reference it adds the lines behind each pass. The site shows them when you open a check. `pnpm evals explain` runs that step alone, for a grade that has none; it never changes an outcome or a score.
3. `pnpm evals push <id|all>` sends a run to the site. `pnpm evals base <project>` sends the starting app, the prompt and the probes, which `/projects/<project>` shows.
4. `site/` (Nuxt 5 on Cloudflare Workers) keeps the row in D1, the raw session in Blob, the summary in ViteHub Content, and the working copy in the project's ViteHub Workspace (`server/workspaces/meetups.ts`): ref `main` is the starting app, and each run commits its files to a ref named after the run. A run records the `main` revision it started from, so a newer starting app does not change older diffs. It imports the session into its Agent journal with `importAgentSession()` from `@vite-hub/agent/sessions` (a pnpm patch). Every session belongs to one Agent, `coding-agent`; the harness (Codex or Claude Code), model and setup are fields of the session. The public Console shows the prompt, notes, thinking, every command with its output, file changes as diffs, the skills the agent had, usage and cost, and the session's Workspace revision. The run page and the project page have a **Preview** tab: it runs that working copy in the reader's browser with `@vite-hub/web-container`. `evals push` and `evals base` build the app's `node_modules` as a WebContainer installs them (`cli/lib/preview.ts`) and upload that snapshot to Blob (`previews/`); the Preview mounts it instead of running `npm install`, which fails from the deployed origin, applies ViteHub's migrations inside the dev server, and starts `nuxt dev`. Without a snapshot it falls back to `npm install`. Pass `--no-preview` to skip the snapshot. Those two pages send `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy: credentialless` for it.

## Run it

```sh
pnpm install
cp cli/.env.example cli/.env          # fill CLIPROXY_API_KEY and INGEST_TOKEN
pnpm evals run meetups --agent opus --repeat 3 --parallel 3 --no-judge   # three Opus sessions at once
pnpm evals run meetups --agent sol                  # agents: opus (medium), fable (high), sol (xhigh), luna (low)
pnpm evals judge <id|all>                           # grade saved Meetups runs again (one app at a time)
pnpm evals judge reference                          # grade the reference app (the yardstick); --project meal-planner for the other project
pnpm evals explain <id|all|reference>               # add fixes and cited lines to a grade that has none
pnpm evals list
pnpm evals push all
pnpm evals rescore <id|all|reference>               # new scores from stored outcomes, without the judge
pnpm evals base meetups                             # prompt, rubric, reference app and its grade for /projects/meetups
pnpm evals reset --yes                              # deletes every run on SITE_URL
```

Other flags: `--harness`, `--model`, `--reasoning`, `--no-summary`, `--no-judge`, `--no-explain` (skip the explain step after a grade). `--agent` picks a model and effort from the model set in `cli/lib/agents.ts`; `--model` alone takes that model's effort from it. Judge at most one app at a time on Slimbook: each grade runs three judge sessions at once (`JUDGE_PARALLEL`). `pnpm evals summarize <id|all>` rewrites summaries.

Site locally: `pnpm dev:site` (http://127.0.0.1:4791). Apply the local migrations once with `pnpm --filter site exec vitehub db migrate`; push to it with `SITE_URL=http://localhost:4791`.

## Deploy

A push to `main` deploys `site/` through Cloudflare Workers Builds, connected to this repository on the `nuxt-evals` Worker (Settings > Builds). GitHub Actions does not deploy. Build command `pnpm --filter site build`, deploy command `pnpm --filter site release` (D1 migrations, then `wrangler deploy --config .output/server/wrangler.json`), build variables `NODE_VERSION=24` and `PNPM_VERSION=11.18.0`. The Worker needs these secrets:

- `NUXT_INGEST_TOKEN`; the CLI sends the same value as `INGEST_TOKEN`.
- `VITEHUB_SECRET`, which signs the Auth sessions.
- `VITEHUB_CONSOLE_TOKEN_SHA256`, the SHA-256 of the Console token. The token is in Bitwarden as "nuxt-evals Console token (console.vitehub.dev)"; paste it into https://console.vitehub.dev under **Link project**.

## Sign-in and the Console

The site has one account, Maxi's, at `/sign-in` (Bitwarden item "nuxt-evals.onmax.me", with a passkey). Sign-up closes once it exists. The account is who Comments (`?vitehub=comments`) and the Content editor let in. The Console is https://console.vitehub.dev with the token above; the app has no Console of its own to sign in to.

## Layout

| Path | What |
| --- | --- |
| `research/` | Plans, research reports, the Discord thread, and findings. Start here. |
| `tasks/` | Task prompts, fixtures and probes. |
| `cli/` | Runs agent CLIs, grades and stores runs, pushes them. Node only. |
| `site/` | Results site and public Console on Cloudflare. |
| `patches/` | pnpm patches on ViteHub, each written up for upstream. `patches/src/` holds the sources of new files. |
