# Findings from v0 (2026-11-07)

v0 runs one dummy task (`tasks/contact-endpoint`) with Codex (`gpt-6-luna`, low effort, setup A) to prove the flow end to end. These are the facts it showed. Each one is a thing to fix, a ViteHub gap, or a number to plan with.

## Numbers

| Run | Time | Input tokens (cached) | Output tokens | Tool calls | Web searches | Probes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 58 s | 166,961 (148,864) | 1,657 | 10 | 1 | 5/5 |
| 2 | 158 s | 133,824 (109,824) | 1,529 | 8 | 0 | 5/5 |
| 3 | 181 s | 166,635 (136,832) | 1,298 | 8 | 1 | 5/5 |

- A trivial task costs about 150k input tokens with Codex, mostly cached. Most of it is the Codex system prompt and tool definitions sent on each turn. Plan the real projects with this baseline.
- Wall time doubled when Slimbook was busy (58 s → 181 s). Time is not a stable metric on a shared machine. Report it, but don't compare setups by it.
- The dummy task is saturated: 3/3 runs pass every probe. That is expected. It only tests the flow.
- Codex used `web_search` in 2 of 3 bare runs, without being asked. Web access is open by design (plan v2), so log it.

## Architecture walls

1. **Provider Drivers can't run on Cloudflare.** `codexDriver()` and `claudeCodeDriver()` need a Node host. A Worker build with one fails with `AGENT_B0019`, and the Cloudflare Sandbox can't host them either (`docs/guides/sandbox-providers.md`: only `trusted-host` and Crabbox forward process input). So v0 is split: `runner/` (Node, Slimbook) runs agents, `site/` (Cloudflare) shows results.
2. **The Cloudflare Console can't show the runner's Agent sessions.** The journal lives with the app that runs the Agent. The runner's local Console (`http://127.0.0.1:4792/_vitehub`) shows them; the public site doesn't. **ViteHub gap:** a remote runner for provider Agents (the app on Cloudflare dispatches, a Node runner executes, the journal is shared), or a journal store that two hosts can share.
3. **The Console has no view for eval results.** The Databases section shows schema, not rows. The site has its own pages. **ViteHub gap:** an Evals section owned by `vite-hub/agent/eval` (plan v2 §7).

## ViteHub paper cuts (vite-hub 0.1.0)

- **`console.authorize` path in Nuxt resolves from `app/`.** `authorize: "./server/console-authorize.ts"` in `nuxt.config.ts` fails with "console.authorize file does not exist: .../site/app/server/console-authorize.ts". Workaround: an absolute path with `fileURLToPath(new URL(..., import.meta.url))`. It should resolve from the Nuxt root dir.
- **`streamAgent(..., { output: "events" })` returns an `AsyncIterable`, not a `ReadableStream`.** The Invocations docs show `ReadableStream` for `ui-message-stream` and don't say what `events` returns. The type is `Promise<Response | AsyncIterable<StreamEvent> | unknown>`.
- **Provider status inspection starts Codex.** With `cwd` and `env` resolvers keyed on the invoker, inspection has no invoker, and Codex still started with the fallback HOME (`.data/runs/missing/home/.codex` appeared). The resolvers get `purpose: "inspection"`, so the app can handle it. It is surprising that inspection runs the provider at all.
- **`driver.env` inherits `HOME`.** ViteHub forwards user-directory variables. `~/.agents/skills` has 59 skills, so a "bare" Codex run would see them. v0 sets `HOME` to an empty folder per run through `driver.env`. Codex then puts its Home in `$HOME/.codex`. **To check:** read the Codex logs in `home/.codex/logs_*.sqlite` to confirm the tool and skill list per run. That is the isolation audit from plan v2.
- **Version skew.** vite-hub 0.1.0 pins `nitro 3.0.260903-beta` and `h3 2.0.1-rc.33`. Nuxt 5 nightly needs `nitro ^3.0.261103-rc`. The root `pnpm-workspace.yaml` overrides both to one version. Nuxt warns `NUXT_B9003`: vite-hub imports `h3` directly, so Nuxt applies its Nitro v2 compatibility layer.
- **The site must depend on `nitro` directly.** vite-hub's Cloudflare output imports `nitro/kv` from the app. Without `nitro` in `site/package.json`, resolution walks up out of the project. On Slimbook it found a stale `~/vitehub/node_modules/nitro` and failed with `"./kv" is not exported`. In CI it would fail as not found. vite-hub could declare `nitro` as a peer dependency so pnpm warns.
- **`cwd` mode has no Workspace diff.** With `driver.cwd`, ViteHub doesn't create a Git baseline or a diff. The runner does it with Git. A Workspace seeded per run from a fixture would give the diff and the Console file view for free.

## Event stream shapes (codexDriver, vite-hub 0.1.0)

From `output: "events"`, about 100 events for a small run:

- `text-delta` (`delta`): progress notes and the final answer. The text after the last tool call is the answer.
- `tool-call` (`name`: `command_execution`, `file_change`, `web_search`; `input.command` for shell) and `tool-result`.
- `data-agent-event` (`turn.started` and others) and `data-agent-plan` (the Codex plan steps).
- One `usage` with `usageRecord.usage`: `inputTokens`, `outputTokens`, `inputTokenDetails.cacheReadTokens`, `outputTokenDetails.reasoningTokens`.
- `finish` with `reason`.

No event lists the tools or skills the provider loaded. The isolation audit needs another source: the Codex logs, or a ViteHub `provider.ready` event with the tool list (a gap to propose).

## Infra

- D1 `nuxt-evals` (`20cf6284-895d-4737-8e2b-d30f9a2328ae`) and R2 `nuxt-evals` in Maxi's Cloudflare account. The site is a Worker on the custom domain `nuxt-evals.onmax.me`.
- CLIProxy has no `gpt-6.1-luna`. The closest are `gpt-6-luna` (used), `gpt-5.6-luna`, `gpt-6.1-terra` and `gpt-6.1-sol`.
- Deploys use Cloudflare Workers Builds (Maxi's choice), not GitHub Actions, so no API token lives in GitHub.
