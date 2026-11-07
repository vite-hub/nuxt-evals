# nuxt-evals

Do the Nuxt MCP, the core Nuxt skills and the nuxt-skills plugin make coding agents write better Nuxt 5 / Nitro v3 / h3 v2 code? This repo runs agents on tasks, grades what they wrote, and publishes the results at [nuxt-evals.onmax.me](https://nuxt-evals.onmax.me).

Status: **v0, dummy data.** One toy task, one agent (Codex with `gpt-6-luna`, low effort), setup A (bare). It exists to prove the flow end to end. The real design is in [research/plan-v2.md](research/plan-v2.md).

## How a run flows

1. `runner/` is a Node ViteHub app on Slimbook. `POST /api/run` copies `tasks/<task>/fixture` into a fresh Git working copy with an empty HOME.
2. The ViteHub Agent `runner/server/agents/codex-a.ts` runs Codex through `cliproxy()` in that directory.
3. The runner reads the files and the diff, runs the task probes, and posts a report to the site.
4. `site/` is a Nuxt 5 app on Cloudflare Workers. It keeps run rows in D1 and transcripts, files and diffs in R2 (ViteHub Database and Blob), and shows them.

The runner can't run on Cloudflare: ViteHub provider Drivers (Codex, Claude Code) need a Node host. See [research/findings-v0.md](research/findings-v0.md).

## Run it

```sh
pnpm install
cp runner/.env.example runner/.env   # fill CLIPROXY_API_KEY and INGEST_TOKEN
pnpm dev:runner                       # http://127.0.0.1:4792, Console at /_vitehub
pnpm eval contact-endpoint 2          # two runs, posted to SITE_URL
```

Site locally: `pnpm dev:site` (http://127.0.0.1:4791).

## Deploy

A push to `main` deploys `site/` to Cloudflare through `.github/workflows/deploy.yml`. It needs the repo secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`. The Worker needs the secret `NUXT_INGEST_TOKEN`.

## Layout

| Path | What |
| --- | --- |
| `research/` | Plans, research reports, the Discord thread, and findings. Start here. |
| `tasks/` | Task prompts, fixtures and probes. |
| `runner/` | Runs agents and grades them. Node only. |
| `site/` | Results site on Cloudflare. |
