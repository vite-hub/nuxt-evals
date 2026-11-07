# Findings from v2: ingest, not relay (2026-11-07)

v2 follows Maxi's call: agents don't run on the server. A local CLI runs the agent's own CLI, keeps the session file it writes, and pushes it. The site imports the session into its Agent journal, so the public Console shows the whole session.

## Decisions

- **`cli/` replaces `runner/`.** No Vite app, no ViteHub Driver: `pnpm evals run` spawns `codex exec --json` or `claude -p --output-format stream-json` directly. The native session file is the source of truth; everything else (usage, final answer, diagnostics, audit) is read from it.
- **`@vite-hub/agent/sessions` (patch 3).** Two readers (Codex rollout, Claude Code transcript) into one `AgentSession`, and `importAgentSession()` into the journal with the original timestamps. The site calls it in `POST /api/runs`. The relay Driver and `codex-a` are gone.
- **Agents are `codex` and `claude-code`.** Setup is a run attribute, not an Agent. Both share the app-wide `agent.invocations` journal.
- **The raw session is kept in R2** (`runs/<id>/session.jsonl`), so a better reader can re-import every run later.

## Proven

- A Codex run (104 s) and a Claude Code run (80 s) import as Console sessions with real timing ("Worked for 1m 38s"), the prompt, progress notes, Codex reasoning summaries as "Thinking", commands with their output and exit code, web searches, file edits, and usage.
- Re-pushing a run replaces its record (`replaced: true`).
- The 4 v0 runs converted from their saved rollouts. The reader fixes two v0 errors: Codex messages now keep `commentary` vs `final`, and step times are the real ones.

## Harness traps

| Trap | Effect | Fix |
| --- | --- | --- |
| Codex refuses to create its helper binaries when `CODEX_HOME` is under `/tmp` ("Refusing to create helper binaries under temporary dir") | No `apply_patch` and no sandbox wrapper; the agent falls back to `cat > file` | Agent homes live in `~/.cache/nuxt-evals/home-*`; working copies stay in `/tmp/run-*/project` |
| `pnpm evals` puts this repo's `node_modules/.bin` folders on PATH | The agent sees the eval's paths | The agent gets `node`'s folder plus system folders only. Codex still prepends its own vendor folder, which is inside this repo's `node_modules` |
| `codex exec` writes no `user_message` event | No prompt in the session | The reader takes the first user message that isn't an injected `<…>` context block |
| CLIProxy has no Codex model metadata for `gpt-6-luna` ("Defaulting to fallback metadata") | May change which tools Codex offers | Open. Check whether a `model_providers` or model catalog setting fixes it |
| Claude Code through CLIProxy returns thinking blocks with a signature and empty text, even with `showThinkingSummaries` (Haiku 5.5 and Opus 5.5). Claude Code transcripts made directly against Anthropic keep the text | The Console shows no Claude thinking | Open. Likely CLIProxy or the model default (`display: omitted`). The reader keeps thinking text when it is there |
| Claude Code loads 3 plugins with an empty config dir | Looked like a leak | They are built into the CLI (`path: "builtin"`); the audit allows them |
| Two Agent Definitions with their own `invocations` setting are two journals; the Console fails with `VITE_HUB_R0047` | No Console | One app-wide `agent.invocations` |
| `nuxt dev` with the Cloudflare preset sends Blob to the R2 HTTP adapter ("missing accountId") instead of the emulated binding | Local ingest fails | `$development: { vitehub: { blob: { driver: "fs" } } }`. ViteHub gap |
| The local dev database starts empty | `no such table: runs` | `pnpm --filter site exec vitehub db migrate` once |

## Audit

`run.json` `diagnostics.audit` lists the skills, MCP servers and plugins each agent was offered (Codex: `<skills_instructions>`; Claude Code: the `system/init` event) and the commands that looked outside the working copy. It already catches real behavior: Codex runs `find .. -name AGENTS.md` in most runs, v0 runs read this repo's `node_modules`, and Claude Code copied its file to `/tmp` to test it. Setup A allows only the bundled Codex system skills and the built-in Claude Code plugins.

## Agent behavior worth a probe later

- Codex ran an empty command and `cat > /tmp/none` before writing the file.
- Claude Code installed dependencies with `npm`, started `nitro dev`, found the fixture's routes 404 even for `/api/health`, and tested the handler through h3 directly. The fixture needs a working `nitro.config` before runtime probes mean anything.
