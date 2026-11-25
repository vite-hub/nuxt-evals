# Findings from v3: one Agent, a real project, a Workspace per run (2026-11-07)

v3 follows Maxi's review of v2: "it should be the same agent", better names, cost in the session, the files of each session in a Workspace, a home page like slopalytics.com, and the first real project with three Codex sessions in parallel.

## Decisions

- **One Console Agent, `coding-agent`.** The harness (`codex` or `claude-code`) is a field of the session (`driver.kind` in the recorded configuration, plus annotations), not a second Agent. `site/server/agents/coding-agent.ts`.
- **Names.** Runs have `project` and `harness` instead of `task` and `agent`. Ids are `20261107-1805-meetups-codex-a1` (batch stamp, project, harness, setup and repeat), so runs of one batch sort together. Session titles read `Meetups · Codex GPT-6 Luna low · A1`.
- **Cost.** The CLIs report tokens, not money. `cli/lib/pricing.ts` prices each run from models.dev list prices (cached for a day), and the importer writes `usage.costUsd` with `costEstimated: true` and `costSource: "models.dev"`. The Console already shows it (`~$0.02`). Long-context tiers are ignored because the CLIs report totals per session.
- **Workspace per project, ref per run.** `site/server/workspaces/meetups.ts` is a ViteHub Workspace on `vite-hub/workspace/blob-database` history (the tables were already there for Content). `main` holds the starting app; `POST /api/runs` commits it again only when the fixture changed, and commits each run's working copy to the ref `<run id>`. The session's configuration records `workspace: { name, ref, revision, base }`, so the Console can open exactly that revision and diff it against `main`.
- **Skills and MCP servers in the session.** The audit's skill and MCP server lists go into the session's configuration (`skills`, `mcpServers`), so the session shows what the agent had, while the Console's Skills section stays for skills the app serves.
- **Reset.** `pnpm evals reset --yes` calls `DELETE /api/runs`: rows, sessions (`store.prune`), raw session files and summaries. Workspace history has no pruning; new runs use new refs.
- **Home page.** The slopalytics shape: full-width app layout, chart tabs (score vs cost, time, tokens, and a probe matrix), group medians labeled at the right edge, a filter sidebar (harness, setup), and the runs as the secondary list.
- **Parallel runs.** `--parallel <n>` runs repeats at once. Each agent gets its own `PORT` (4900 + repeat).

## The first real project: Meetups

`tasks/meetups` (see its README): a partly built Nuxt 5 app with Nuxt UI, 2,000 events, a slow paid rates API and a slow mailer. Six features in product words, 2 gate probes and 20 probes, checked against one reference and four tempting-wrong solutions, stable over 3 runs. It covers the replies to Maxi's post on X (2119005553775030726): `$fetch` in setup, hydration, `window` in setup, `process.env`, h3 validation, and Nuxt UI component APIs.

## Harness traps found in v3

| Trap | Effect | Fix |
| --- | --- | --- |
| Codex `workspace-write` only writes the working copy | pnpm can't create its cache in HOME, so the agent's `pnpm build` fails, and it says so in its final answer | `sandbox_workspace_write.writable_roots=[<home>]` |
| Codex `workspace-write` blocks the network | No listening port for a smoke test, no installs, no web | `sandbox_workspace_write.network_access=true` (the web is open in every setup) |
| corepack with an empty HOME downloads pnpm on first use (about 80 s) | Slow first command | `COREPACK_HOME` points at the machine's cache |
| `vitehub db generate` asks whether a column was renamed, and fails without a TTY | No migration | Two migrations: drop the old columns, then add the new ones. SQLite needs a default for an added `NOT NULL` column |
| `vitehub db migrate` refuses dropped columns locally | Local DB stays old | `--allow-data-loss` locally; `wrangler d1 migrations apply` in Workers Builds has no such guard |

The first three pilot runs ran with the first two traps and are kept in `cli/.data/archive/pilot-0-sandbox-bug/`. They are not on the site.

## What the agents got wrong (first pilot, before the sandbox fix)

- One run named a route `server/api/events/[slug].rsvp.post.ts`. Nitro v3 reserves dotted suffixes in scanned file names, so `nuxt build` fails. This is a real Nitro v3 trap that a skill should teach.
- One run's event pages answered 404 for real events.
- Every run missed the server-rendered link preview (`og:title`) and the US and UK prices in the server HTML.
