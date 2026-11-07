# Findings from v1 (2026-11-07)

v1 builds the whole structure on the saved dummy runs: a Comark summary per run in ViteHub Content, an Agent session per run in the site's Console, a workspace browser, and Console access for guests and a signed-in maintainer. Real runs come later.

## Decisions

- **ViteHub from pkg.pr.new.** Every `vite-hub` and `@vite-hub/*` package points at one build of `main` (`node scripts/vitehub.mjs <sha>`). Gaps are pnpm patches in `patches/`, each written up for an upstream PR.
- **No remote runner yet.** Codex still runs in `runner/` on Slimbook. The site replays the saved events into its own Agent, so the session exists in the site's journal and Console. The live version later streams the same events into the same Agent.
- **Summaries are Content documents.** `site/server/content.ts` defines a `runs` collection on the `cms` preset (Blob + D1 store). The runner's summarizer writes Comark; the site saves and publishes it on ingest; `/runs/:id` renders it with `comark-ui/vue`.
- **Access.** Guests see the Agent sessions read-only (`console.guest`). Maxi signs in at `/sign-in`, a path behind a Cloudflare Access app, and the Console knows him on every path through the Access cookie. Both are patches.

## What was proven

- **A custom `run` Driver can replay a provider session.** Returning `{ stream }` of saved Codex events makes the journal record the same observations as the real run: messages, `agent.tool.start`/`finish`, usage, finish. This is the base of a future `relayDriver()` and of the remote runner.
- **The journal record id is `sha256(JSON.stringify([agentName, runId]))`.** The `agent:finish` hook gives `invocation.run.runId` but not the record id, so the site computes the Console link itself (`site/server/utils/relay.ts`). **Gap:** expose the record id on the finish event, or let the Console route accept a run id.

## Gaps found (ViteHub main a7f259c)

| Gap | Where | Handled by |
| --- | --- | --- |
| No guest grant: auth modes reject a request without a session before `authorize` runs | `console/runtime/server/access.ts` | Patch 1 (`console.guest`) |
| Cloudflare Access mode reads only the `cf-access-jwt-assertion` header | `console/auth-cloudflare-access.ts` | Patch 2 (cookie fallback) |
| `console.signInPage` refuses Cloudflare Access mode | `console/vite.ts` | Not needed with the cookie: `/sign-in` is the Access app path |
| Finish hook has no journal record id | `@vite-hub/agent` hooks | App computes it |
| No Console view for Workspace files; Workspaces lists only Definitions. Apps can't contribute a Console section, and the Console client ships prebuilt, so a pnpm patch can't add one | Console | App-side `WorkspaceBrowser` now; a vite-hub PR for a Workspaces browser next |
| Console session view (conversation + inspector) is not in `@vite-hub/ui` | `vite-hub` Console runtime | Link to the Console for now |
| `vitehub db generate` runs out of memory (4 GB heap) in this Nuxt 5 app once `server/content.ts` uses the `cms` preset. The drizzle config and schema it writes first are fine: `drizzle-kit generate --config .vitehub/database/drizzle.config.ts` works with a 1.5 GB heap | `@vite-hub/cli` db generate | drizzle-kit directly |
| ViteHub's generated server code imports `@vite-hub/agent` (and other inner packages) from the app root, but the app doesn't list them. Under pnpm 11 they aren't hoisted, so resolution walks up out of the project: on Slimbook into `~/vitehub/node_modules` (links to the ViteHub monorepo), on CI to "not found" | `vite-hub` virtual modules | `publicHoistPattern: ["@vite-hub/*"]`, plus `@vite-hub/agent` as a direct dependency of both apps: pnpm doesn't hoist it, probably because it has several peer variants |
| `pnpm patch-commit` fails on pkg.pr.new dependencies (fetches the version from npm) | pnpm | Patches written by hand, see `patches/README.md` |
| pkg.pr.new tarballs have no integrity hash. pnpm 10 then refuses a **patched** pkg.pr.new package (`ERR_PNPM_MISSING_TARBALL_INTEGRITY`), even on a fresh install | pnpm 10 + pkg.pr.new | pnpm 11.18.0 with `blockExoticSubdeps: false`, as Drop uses |

Fixed on `main` since 0.1.0: `console.authorize` in Nuxt now resolves from the root dir, not `app/`.

## Workspace browser

`site/app/components/WorkspaceBrowser.vue` has three panes, like the Console's Agent session: all workspaces, the file tree, one open file. It only composes `@vite-hub/ui` parts (`FileTree` from `@vite-hub/ui/file-tree` with `paths` and `onSelectionChange`, `FileView` from `@vite-hub/ui/file-view` with `{ name, contents }`), so it can move into `@vite-hub/ui` and back the Console's Workspaces section. Both parts render in shadow DOM on the client, so the page wraps them in `<ClientOnly>` with a `<pre>` fallback.

## Comark

- `comark-ui/vue` leaves out `::screenshot`, `::compare` and `::diff` (HTML only). Summaries use what Vue renders: GitHub callouts, code fences with `mark`/`ins`/`del` and numbered code notes, `::steps`, `::stats`, `::details`.
- `comark-ui` fetches favicons, Iconify sets and Kroki diagrams while parsing. The site turns off favicon downloads; icons still come from Iconify at render time.
- Shiki is not in the preset; it goes right before `comark-code`.

## Summarizer

`runner/server/agents/summarizer.ts` is a model-backed ViteHub Agent: `languageModel(cliproxy(), "claude-opus-5-5")` from `@vite-hub/gateways/ai-sdk` (needs `@ai-sdk/openai-compatible`). It reads a digest of the run (prompt, probes, steps, answer, diff, usage), not the raw events.
