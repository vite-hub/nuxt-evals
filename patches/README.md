# Patches to upstream

nuxt-evals runs on pkg.pr.new builds of [vite-hub/vitehub](https://github.com/vite-hub/vitehub) (`node scripts/vitehub.mjs <sha>` moves every package to one commit). When ViteHub lacks something this project needs, the fix lands here first, then goes upstream as one PR per concern, so every ViteHub app gets it. Delete it here once its PR is merged and released.

pnpm can't run `pnpm patch-commit` on a pkg.pr.new dependency: it tries to fetch the version from npm. Make the patch by hand instead: `pnpm patch <pkg>@<version> --edit-dir /tmp/x`, edit, then `git diff --no-index` the installed copy against `/tmp/x` with `a/` and `b/` paths. Bumping the commit changes the dist file hashes, so rebase each patch on the new build.

## ViteHub main

Since 2026-11-12 the pinned commit is on `main` of vite-hub/vitehub again: the UI work that needed branch `preview/nuxt-evals` merged (#3952 code focus, #3722 AgentSession, #3764 DeviceFrame). pkg.pr.new builds only commits whose CI passed, so pin the newest `main` commit that `https://pkg.pr.new/vite-hub/vitehub/vite-hub@<sha>` answers.

The Console is console.vitehub.dev with signed calls (`console: true`); the app keeps the link's public key as the Worker secret `VITEHUB_CONSOLE_KEY_CONSOLE_<id>`.

## @vite-hub/agent@0.0.0-preview-e6bc079

### 3. `@vite-hub/agent/sessions`: import provider session files as Agent Invocations

**Gap.** An Agent session exists only when the Agent runs in the app. Codex and Claude Code often run elsewhere (a laptop, CI, an eval runner, and Provider Drivers can't run on Workers at all), and each writes its own session file. ViteHub can't read those files, and an app can't put a finished session in its journal with its real timing. v1 worked around it with a fake `run` Driver that replayed events: every step got the import time, and all Codex messages came out as `final`.

**Patch.** A new entry, `@vite-hub/agent/sessions`, made of new files only (`dist/sessions.js`, `dist/sessions.d.ts`, one `exports` entry). Sources in `patches/src/agent-sessions/`; `node scripts/patch-agent.mjs` rebuilds the patch from a clean tarball.

- `readCodexSession(text)` reads `$CODEX_HOME/sessions/**/rollout-*.jsonl`; `readClaudeCodeSession(text)` reads `$CLAUDE_CONFIG_DIR/projects/<project>/<session>.jsonl`. Both return one provider-neutral `AgentSession`: prompt, steps (messages with `commentary`, `reasoning` or `final` phase, tool calls with input, output, exit code, duration and file-change diffs), usage, model, status.
- `importAgentSession(store, session, { agentName, runId, title, invoker, annotations })` writes it to an Agent Invocation store as a finished Invocation with the session's own timestamps. The record id is the one ViteHub gives a run of `agentName` with `runId`, so the Console link is known up front. Importing again replaces the record.
- Commands use the Console's `command_execution` shape, file edits its `fileChange` shape, so the Console renders them like a live session.

**Upstream.** `packages/agent/src/sessions.ts` with tests on recorded session files of both CLIs. Better shapes to discuss in the PR:

- `invocations.import(session)` on `AgentInvocations`, instead of taking a raw store, so redaction and content policy apply.
- An external Agent (`defineAgent({ external: true })`) for Agents that only have imported sessions. nuxt-evals defines a Driver that throws (`site/server/utils/external-agent.ts`).
- The Codex and Claude Code Drivers could record the native session id, so a live session and its file link up.

Since v3, `importAgentSession()` also takes `configuration` (skills, MCP servers, and the Workspace name, ref and revision of the session) and `cost` (`{ usd, estimated, source }`). The configuration lands in `vitehub.agent.configured`; the cost in `agent.usage.recorded` and the finish record's `usage.record.cost`. Upstream, a Driver could record the skills it offered and a Workspace commit itself.

## @nuxt/fonts@0.14.0

### 5. Fonts ship as empty files on Nuxt 5

`@nuxt/fonts` writes an empty placeholder for each font, then fills it in Nitro's `rollup:before` hook, but only after Vite's `vite:compiled` hook has run. Nuxt 5 never calls `vite:compiled` at that point, so every file in `.output/public/_fonts` stays 0 bytes and the site falls back to system fonts (it looked right only on machines with Geist installed). The patch fills the files in `build:config`, the Nitro v3 hook, without the `built` check. Upstream: nuxt/fonts (not Maxi's repo, so a drafted issue only), checking the files after the Nitro build instead.
