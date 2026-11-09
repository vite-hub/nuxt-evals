# Patches to upstream

nuxt-evals runs on pkg.pr.new builds of [vite-hub/vitehub](https://github.com/vite-hub/vitehub) `main` (`node scripts/vitehub.mjs <sha>` moves every package to one commit). When ViteHub lacks something this project needs, the fix lands here first as a pnpm patch, then goes upstream as one PR per concern, so every ViteHub app gets it. Delete a patch once its PR is merged and released.

pnpm can't run `pnpm patch-commit` on a pkg.pr.new dependency: it tries to fetch the version from npm. Make the patch by hand instead: `pnpm patch <pkg>@<version> --edit-dir /tmp/x`, edit, then `git diff --no-index` the installed copy against `/tmp/x` with `a/` and `b/` paths. Bumping the commit changes the dist file hashes, so rebase each patch on the new build.

## vite-hub@0.0.0-preview-a7f259c

### 1. `console.guest`: read-only sections for visitors without a session

**Gap.** In `auth: "app"`, Console Auth and Cloudflare Access modes, the Console rejects a request without a session before `authorize` runs. An app can't say "everyone may read Agent sessions, a signed-in maintainer sees everything" without writing its own access code behind `auth: false`.

**Patch.** `console: { guest: { sections: ["agents:read"] } }`. When the mode's check finds no session, the request gets those sections instead of the sign-in rejection. A signed-in request is unchanged.

- `src-*.js`: `resolveConsoleAccessBuild()` validates `console.guest` and passes it to the build; the code generator writes `guest` into `installConsoleAccess({ … })`.
- `access-*.js`: `checkConsoleAccess()` issues a grant with the guest sections when `policy.check()` returns a rejection.
- `console/auth-cloudflare-access.js`: in Cloudflare Access mode a generated middleware rejects every `/_vitehub` request without an Access token before any route runs. With `guest` set it lets the request continue (the routes above then grant the guest sections); the identity route still answers 401. It reads `guest` from the installed access policy (`globalThis[Symbol.for("vitehub.console.access")]`), so the code generator is unchanged. Found only in production: `nuxt dev` skips the middleware.
- `index-*.d.ts`, `access-*.d.ts`: the `guest` option types.

**Upstream.** `packages/vite-hub/src/console/vite.ts`, `console/plugin.ts`, `console/runtime/server/access.ts`, the Console options type, docs (`development/console.md`), and tests for each mode.

### 2. Cloudflare Access mode reads the `CF_Authorization` cookie

**Gap.** `verifyCloudflareAccessConsoleRequest()` reads only the `cf-access-jwt-assertion` header. Cloudflare adds it only on paths that an Access application protects, so the Console must sit behind Access entirely, and nobody else can see any of it.

**Patch.** Fall back to the `CF_Authorization` cookie, which Cloudflare sets for the host once the user passes any Access application on it. nuxt-evals protects only `/sign-in`; the Console then knows Maxi everywhere, and `console.guest` serves everyone else. The token is verified the same way, with the same audience and issuer.

**Upstream.** `packages/vite-hub/src/console/auth-cloudflare-access.ts`, docs (`frameworks-hosts/cloudflare.md`), tests with a cookie-only request.

### 4. Console iteration from the evals review (branch `console/evals-iteration`)

The source is 20 commits on `a7f259c` in a ViteHub worktree, branch `console/evals-iteration`. The branch is now rebased on `main` as vite-hub/vitehub#3722, so rebuild the patch from the pre-rebase head `7c54462c2a`. The patch adds the built files, so it is about 17 MB: every renamed hashed chunk is a delete plus an add. Rebuild it with `~/vitehub/nuxt-evals-console-out/scripts/assemble-vite-hub.mjs <worktree> <old patch> <out>`, then replace the patch hash in `pnpm-lock.yaml`. Notes, measurements and before/after screenshots: `~/vitehub/nuxt-evals-console-out/NOTES.md` and `shots/`.

- **One session details toggle**, the last icon button at the top right of the session header, like T3 Code's panel toggle. One header spans the thread and the details panel, so the toggle keeps the same box open and closed (1398, 11, 22 × 22 at 1440 × 900) and keeps focus. The thread keeps its scroll. Before, opening moved the toggle 433 px and closing used a second button.
- **Tabs and sections hide when empty**: Capabilities when the session recorded none; Skills, Channels and Env in the navigation when no Agent bundles a Skill, has a Channel, or the app declares Env. Their operations stay, so the CLI still reads them.
- **`console.sections: { <section>: false }`** removes a section and its Console routes. nuxt-evals hides Content.
- **Session Usage block**: cost ("Estimated from models.dev") and tokens. The Console also reads `usage.costUsd` from `agent.usage.recorded` when the finish record has no cost.
- **Session Agent setup lists Skills and MCP servers** from the recorded configuration.
- **Session Workspace opens the recorded revision** (`configuration.workspace.revision`), with "Changes since main" and diffs.
- **Workspaces section**: refs and revisions, file tree, file, diff against `main`. New read operation `workspaces.files` (`vitehub workspaces files <name>`).
- **Env "Check status"** shows progress and a result. **Blob** opens a file on double click, with an Open button for keyboard and touch.
- **Session Details polish**: Geist tabular figures instead of monospace, one 12/13/14 px scale, label-value rows, zero token types hidden, "Estimated cost" with the source in a tooltip, a Provider row only when the provider didn't make the model, "Imported session" instead of "import", quiet Skill and MCP chips, compact identifiers, model names like "Claude Haiku 5.5". The tab chip and its buttons share one size and radius.
- **A session is an AgentSession** (commit `07bde1fc12`): the Console's session view uses the layout of patch 6, with a details card and Workspace, Changes, Trace, Capabilities and Details as right panel surfaces. The inspector gains a single-view mode for them. Phones keep the slideover.
- **Copy session link** (commit `7c54462c2a`): the AgentSession header copies the session URL, like the old navbar.
- **Usage** in the slopalytics style: big numbers that pick the metric (sessions, tokens, est. spend), 7/14/30 days, a share bar, ranked rows, filters on the right.
- **Workspace footer** (commit `382c3d9342`): an unchanged file printed its full 64-character revision in a footer that could not shrink, and pushed the file tree off the panel. It now says "Unchanged since main". The fix is applied to the built Console too: `console-app-*.js`, `console-session-*.css` and the entry `console-*.js` are renamed to `*-Nx3v9Wq1`, because the old names are cached as `immutable` for a year.

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

Since v3, `importAgentSession()` also takes `configuration` (skills, MCP servers, and the Workspace name, ref and revision of the session) and `cost` (`{ usd, estimated, source }`). The configuration lands in `vitehub.agent.configured`; the cost in `agent.usage.recorded` and the finish record's `usage.record.cost`. Upstream, a Driver could record the skills it offered and a Workspace commit itself.

## @vite-hub/ui@0.0.0-preview-a7f259c

### 6. `AgentSession`: a T3 Code style session layout

- Source: commits `1d2fca14d6` and `2579d94d39` on branch `console/evals-iteration`, in `packages/ui/src/components/agent-session.ts` and the AgentSession block of `packages/ui/styles.css`.
- The patch adds the `./agent-session` export and its built files, and replaces `dist/index.js`, `dist/nuxt.js` and `dist/styles.css` with the build of that commit. The other files of the build are the same as the published ones.
- The run page (`site/app/components/RunAgentSession.client.vue`) and the Console's session view (patch 4) use it. Both go upstream as one pull request.
- Rebuild the patch from the branch with `packages/ui/.evidence/agent-session/repatch-evals.sh` in the worktree (untracked).
- Details pass against a live T3 Code instance (commit `010b67c51d`): title before subtitle at narrow widths, a 20px heading inset, a symmetric text column, borderless inline code, 1.625 leading through comark's `--typeset-leading`, no close button on a lone tab, T3's work group chevron and hairline, 12px panel code and emerald diff additions. A second pass (commit after `382c3d9342`) reads the host's fonts through `--vh-font-sans` and `--vh-font-mono`, fades a folded user turn instead of clamping it, and keeps the text column at least 34rem. These edits are applied by hand to `dist/agent-session-oKHRgDl3.js` and `dist/styles.css` (the compiled chunk predates the branch's `visibleTabs`, so it uses `tabs`).

### 7. `DeviceFrame`: the Preview at a device's size

- Source: commit `326c8dca89` on branch `ui/device-frame`, in `packages/ui/src/components/device-frame.ts` and the `.vh-device-frame` block of `packages/ui/styles.css`.
- The patch adds `dist/device-frame.js`, its chunk and types, the `./device-frame` export, and appends the DeviceFrame CSS to `dist/styles.css`. The component imports only `vue`, so the chunk is copied as built.
- The Preview tab (`site/app/components/AppPreview.client.vue`) uses it for its device mode. It goes upstream as its own pull request; Drop uses the same component.

## @nuxt/fonts@0.14.0

### 5. Fonts ship as empty files on Nuxt 5

`@nuxt/fonts` writes an empty placeholder for each font, then fills it in Nitro's `rollup:before` hook, but only after Vite's `vite:compiled` hook has run. Nuxt 5 never calls `vite:compiled` at that point, so every file in `.output/public/_fonts` stays 0 bytes and the site falls back to system fonts (it looked right only on machines with Geist installed). The patch fills the files in `build:config`, the Nitro v3 hook, without the `built` check. Upstream: nuxt/fonts (not Maxi's repo, so a drafted issue only), checking the files after the Nitro build instead.
