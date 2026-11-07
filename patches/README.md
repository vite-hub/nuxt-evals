# Patches to upstream

nuxt-evals runs on pkg.pr.new builds of [vite-hub/vitehub](https://github.com/vite-hub/vitehub) `main` (`node scripts/vitehub.mjs <sha>` moves every package to one commit). When ViteHub lacks something this project needs, the fix lands here first as a pnpm patch, then goes upstream as one PR per concern, so every ViteHub app gets it. Delete a patch once its PR is merged and released.

pnpm can't run `pnpm patch-commit` on a pkg.pr.new dependency: it tries to fetch the version from npm. Make the patch by hand instead: `pnpm patch <pkg>@<version> --edit-dir /tmp/x`, edit, then `git diff --no-index` the installed copy against `/tmp/x` with `a/` and `b/` paths. Bumping the commit changes the dist file hashes, so rebase each patch on the new build.

## vite-hub@0.0.0-preview-a7f259c

### 1. `console.guest`: read-only sections for visitors without a session

**Gap.** In `auth: "app"`, Console Auth and Cloudflare Access modes, the Console rejects a request without a session before `authorize` runs. An app can't say "everyone may read Agent sessions, a signed-in maintainer sees everything" without writing its own access code behind `auth: false`.

**Patch.** `console: { guest: { sections: ["agents:read"] } }`. When the mode's check finds no session, the request gets those sections instead of the sign-in rejection. A signed-in request is unchanged.

- `src-*.js`: `resolveConsoleAccessBuild()` validates `console.guest` and passes it to the build; the code generator writes `guest` into `installConsoleAccess({ … })`.
- `access-*.js`: `checkConsoleAccess()` issues a grant with the guest sections when `policy.check()` returns a rejection.
- `index-*.d.ts`, `access-*.d.ts`: the `guest` option types.

**Upstream.** `packages/vite-hub/src/console/vite.ts`, `console/plugin.ts`, `console/runtime/server/access.ts`, the Console options type, docs (`development/console.md`), and tests for each mode.

### 2. Cloudflare Access mode reads the `CF_Authorization` cookie

**Gap.** `verifyCloudflareAccessConsoleRequest()` reads only the `cf-access-jwt-assertion` header. Cloudflare adds it only on paths that an Access application protects, so the Console must sit behind Access entirely, and nobody else can see any of it.

**Patch.** Fall back to the `CF_Authorization` cookie, which Cloudflare sets for the host once the user passes any Access application on it. nuxt-evals protects only `/sign-in`; the Console then knows Maxi everywhere, and `console.guest` serves everyone else. The token is verified the same way, with the same audience and issuer.

**Upstream.** `packages/vite-hub/src/console/auth-cloudflare-access.ts`, docs (`frameworks-hosts/cloudflare.md`), tests with a cookie-only request.

## @vite-hub/agent@0.0.0-preview-a7f259c

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
