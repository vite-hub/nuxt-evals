# Local Nuxt skills, vite-doctor and CLIProxy facts

> Research subagent report, 2026-11-07, for the eval plan. Facts were true on that date: check them again before you rely on one. Read-only research; nothing was run.

I found five things that shape the plan. Codex's bare setup is contaminated unless its config folder is isolated, and the skills target Nuxt 5 only in part. Nuxt 5 is not on `nuxt@latest`. vite-doctor can grade statically with JSON output, but it has no lazy-component or payload-size rules. CLIProxy's quota and concurrency limits are not visible to me.

## Answer: the facts that constrain the plan

1. **Nuxt 5 exists only as a nightly.** `nuxt@latest` is 4.6.4. Nuxt 5 is `nuxt-nightly@5x` = `5.0.0-2611070044-e3875e8` (today's build), and it pulls `@nuxt/nitro-server-nightly`. `nitro@latest` is `3.0.261103-rc` and `h3@latest` is `2.0.8` (stable). Task fixtures must pin one nightly SHA, or the target moves between runs.
2. **Codex leaks Nuxt skills globally.** `~/.codex/skills/` holds the full nuxt-skills set (nuxt, nitro, nuxt-ui, nuxthub, vue, pinia and others). The Codex docs also list `$HOME/.agents/skills` as a user scope, and `CODEX_HOME` does not move it. That folder holds `seo-content` and `vitehub-projects`. A bare Codex run needs a fresh `CODEX_HOME` and a fresh `HOME`, or `[[skills.config]] enabled=false` entries. Codex also keeps a `memories_1.sqlite`.
3. **Claude Code leaks less but still needs isolation.** `~/.claude/settings.json` enables the `pstack` plugin, and `~/.claude/skills` has 58 skills. None of them are Nuxt skills apart from `vitehub-projects`. Use `CLAUDE_CONFIG_DIR=<fresh>` with `--setting-sources ""` (or `--bare`), `--strict-mcp-config --mcp-config <file>`, and `--disallowedTools WebFetch WebSearch`.
4. **The Nuxt skill is mostly Nuxt 5, but other skills are Nuxt 4.** `skills/nuxt/SKILL.md:12` says "based on Nuxt 5.x (`5.0.0-0`)" and uses `nuxt/server` imports. That subpath exists in both nuxt 4.6.4 and the 5x nightly. The module skills (better-auth, content, nuxthub, nuxt-ui chat) and every nuxt-skill-hub rule still use Nuxt 4 auto-imported handlers. The nitro skill has one wrong claim: it says h3 v2 dropped `readBody`.
5. **vite-doctor works as a static grader with some gaps.** `--format json` emits schema `vite-doctor.report/v3`. Each diagnostic has `ruleId`, `code`, `severity`, `file`, `range`, `confidence`, `evidence` and `fingerprint`. Exit codes are 1 when there are errors and 2 on an invocation failure. You can select rules with `--rules` and limit to changed lines with `--changed`/`--since`. There are no rules for lazy components or payload size. Doctor drops version-specific checks when it cannot resolve the Nuxt to Nitro to H3 graph, and the nightly aliasing may trip that (not verified).
6. **The CLIProxy model IDs are `claude-opus-5-5` and `gpt-6.1-sol`.** I confirmed both through `/v1/models` on 127.0.0.1:8317. The management usage endpoint returned 401 with the client key, and `/srv/cliproxy` is not readable by `maxi`. I could not see the quota, concurrency or token-log state. A weekly quota ping timer exists, which suggests subscription weekly quotas.
7. **The planned skill discovery does not exist yet.** nuxt.com/mcp has no skill-finding tool, and nuxt/cli has no skill support. Today, module skills reach a project only through nuxt-skill-hub, which resolves them during `nuxt prepare`. Setup C has to inject module skills by hand or through skill-hub.

## 1. `/home/maxi/nuxt/skills` (branch `remove-t3-code-continue-thread`, last commit 2026-11-05)

- **Skills present:** arkenv, comark, eve, nanime, nitro, nuxt, nuxt-better-auth, nuxt-content, nuxt-i18n, nuxt-modules, nuxt-protokit, nuxt-seo, nuxt-studio, nuxt-ui, nuxt-users, nuxthub, pinia, regle, reka-ui, unocss, vite, vitest, vue, vue-best-practices, vue-debug-guides, vue-router-best-practices, vue-testing-best-practices, vueuse-functions, yapyak.
- **Missing skills:** there is no separate h3, nuxt-image, nuxt-auth-utils or nuxt-scripts skill.
- **Where they come from:** nuxt, nitro, pinia, vue, vite, vitest and unocss are bundled from antfu/skills (`ecosystem-skills.json`), generated 2026-09-25. The `vue-*` skills come from vuejs-ai/skills. `versions.json` only pins `{reka-ui:2, nuxt-ui:4}`. `CLAUDE.md` still says "Vue 3, Nuxt 4+, NuxtHub v0.10".
- **Targets:**
  - nuxt: Nuxt 5 (`SKILL.md:16`, with `nuxt/server` imports and `nitroLegacy`).
  - nitro: Nitro v3 beta 3.0.260903 (`nitro/SKILL.md:10`).
  - nuxthub: v0.10.8.
  - nuxt-ui: v4.
- **Packaging:**
  - `.claude-plugin/plugin.json` sets `"skills": "./skills/"`.
  - `.codex-plugin/plugin.json` sets skills plus `mcpServers: ./.mcp.json`, which is http `https://nuxt.com/mcp`.
  - Root `plugin.json` and `mcp.json` follow the agent-plugins format.
  - Versions drift: root 1.3.7, plugins 1.3.8, marketplace 1.3.9.
- **One plugin bundles everything.** The core skill and the module skills ship together, so B and C cannot be told apart through the plugin. Use per-skill directories instead.

## 2. `/home/maxi/nuxt-skill-hub` (branch `fix/template-dependency-guidance`, 3 commits behind origin/main; npm 0.3.1, local package.json 0.3.0)

- **What it is:** a Nuxt module. On `nuxt prepare` it writes a router skill plus `references/{nuxt/rules, vue, modules}` into `.claude/skills/<name>/` and `.codex/skills/<name>/`.
- **Agent detection:** it picks targets from agent config folders in `$HOME`, which matters inside a sandbox. Set `targets` explicitly.
- **How it finds module skills, in order:**
  1. The installed package's `agents.skills` field.
  2. The GitHub repo's `agents` field.
  3. The docs site's `.well-known/agent-skills` or `.well-known/skills`.
  4. GitHub path heuristics (opt-in).
  5. A metadata router that links the repo and docs.

  Overrides for @nuxt/ui, @vueuse, @nuxt/content, nuxt-studio and docus live in `src/package-overrides.ts:11-55`.
- **The plan's phases 3 and 4 are not built.** The `.research/nuxt-agents/diagram.html` plan reads: plugin (1), MCP plus core skills (2), "nuxt module add" installs module skills (3), nuxt.com/mcp "find skills" (4). nuxt/cli has no skill code (`gh search code skills --repo nuxt/cli` returns `[]`), and the live MCP has no skill tool.
- **Tests:** about 20 vitest files (generation, remote resolver, monorepo, fingerprint, agents). I did not run them.
- **The `nuxt-best-practices/rules` (15 files) are Nuxt 4 style.** Examples have no imports, use `defineCachedEventHandler`, and pass `Body.parse` to `readValidatedBody`. They do use `status`/`statusText`.

## 3. Nuxt MCP

- **Live probe of `https://nuxt.com/mcp`** (streamable HTTP, server "Nuxt" 1.0.0). Tools:
  - `list-documentation-pages`, `get-documentation-page`, `get-getting-started-guide`
  - `list-blog-posts`, `get-blog-post`
  - `list-deploy-providers`, `get-deploy-provider`
  - `get-changelog`
  - `list-modules`, `get-module`
  - `list-nuxters`, `get-nuxter`
- **Prompts:** deployment-guide, find-documentation-for-topic, migration-help and others. It also exposes resources.
- **The version defaults to `4.x`.** The enum allows `5.x`. Agents must pass `5.x` or they will read Nuxt 4 docs, so mention it in the task prompt or leave it as a measured variable.
- **There is no documented local server.** `nuxt-mcp` 0.2.6 (antfu, a dev-server MCP about the app) is a separate thing.
- **Claude Code config:** `.mcp.json` `{"mcpServers":{"nuxt":{"type":"http","url":"https://nuxt.com/mcp"}}}` plus `--strict-mcp-config`. The docs give `claude mcp add --transport http nuxt https://nuxt.com/mcp`.
- **Codex config:** `[mcp_servers.nuxt] url = "https://nuxt.com/mcp"` in the isolated `CODEX_HOME/config.toml`, or a `-c` override. I inferred this form from Maxi's working `executor` block.

## 4. `/home/maxi/nuxt/vite-doctor` (branch `surfaces-audit-fix`, 22 commits behind origin/main; npm 0.1.2 from 2026-11-01)

- **Rule API:** `createRule({ meta:{id,title,category,severity,fixable,docsUrl,requires:{script,nuxt|nitro}}, create(ctx){ return { AwaitExpression(node){…} } } })`.
  - `ctx.file` exposes `isVueSfc`, `inAppDir` and `sfc`.
  - The AST gives parent links through `__doctorParent`.
  - Calls are matched by callee name, not import source, so `nuxt/server` imports still match.
  - Factories exist, such as `createValidatedInputRule` (`src/rule-packs/nitro/rules/request-helpers.ts:39`).
  - Project Inventory holds cross-file facts, such as the component usage graph.
  - Module packs turn on through `activation`, for example `nuxthub.ts:238`.
- **Relevant rule IDs:**

| Area | Rule IDs |
| --- | --- |
| Data fetching | `nuxt/fetch/no-raw-fetch-in-setup`, `require-stable-asyncdata-key`, `forward-auth-headers-ssr`, `prefer-create-use-fetch` |
| State | `nuxt/ssr/no-module-scope-request-state`, `nuxt/state/no-nonserializable-usestate`, `prefer-explicit-usestate-key-in-exported-composables` |
| h3 validation | `nitro/request/prefer-validated-{body,query,router-params}`, `prefer-assert-method` |
| Server/client boundaries | `nuxt/structure/no-server-utils-in-app`, `no-server-types-in-app`, `nitro/server/no-browser-api`, `nitro/server/no-client-composables`, `nitro/context/no-usenuxtapp-in-nitro`, `nuxt/shared/no-vue-or-nitro-context-in-shared`, `nuxt/hydration/*` (6 rules) |
| Env and runtime config | `nuxt/runtime/no-plain-env-in-app-code`, `no-secret-in-public-config`, `nuxt/config/no-runtime-env-in-build-options`, `nitro/runtime/{no,require}-event-runtime-config-in-server` |
| Caching | `nitro/cache/no-module-scope-response-cache`, `nuxthub/prefer-cached-event-handler`, `nuxthub/no-personalized-cached-handler` (only with @nuxthub/core) |
| Head and SEO | `nuxt/seo/prefer-seo-composables`, `nuxt/security/no-unsafe-usehead-script`, `prefer-useheadsafe-for-untrusted-values` |
| Images | `nuxt-image/prefer-nuxtimg`, `require-alt`, `prefer-responsive-dimensions`, `prefer-nuxtpicture-for-formats` |
| Links and routing | `nuxt/routing/prefer-nuxtlink`, `prefer-nuxtpage-over-routerview` |
| Migration | `nitro/migration/no-v2-imports`, `nitro/h3/no-removed-send` |

  - **Not covered:** lazy components and payload size have no rules.
- **Grading mode:** `vite-doctor migrate . --to nuxt@5 --format json` also exists.
- **Tests:** per-rule fixture runners (`tests/rule-fixtures.ts`) and 3 all-issues fixtures. `scripts/perf-lab/corpora.json` pins 4 real repos for performance only. I found no labelled false-positive set beyond the unit fixtures.

## 5. CLIProxy (fleet skill)

- **Location:** user service `cliproxyapi.service` (account `svc-cliproxy`) on port 8317, with config in `/srv/cliproxy/.config/cliproxyapi`. It is public as `ai.onmax.me` behind Cloudflare Access.
- **Claude Code** on Slimbook uses `ANTHROPIC_BASE_URL=http://127.0.0.1:8317` and `ANTHROPIC_AUTH_TOKEN` from the env block of `~/.claude/settings.json`.
- **Codex** uses `model_provider="cliproxy"`, `base_url="https://ai.onmax.me/v1"`, `wire_api="responses"`, `experimental_bearer_token` and CF-Access `http_headers`.
- **ServaRICA:** it reaches the proxy over Cloudflare with its own Access token (`fleet/SKILL.md:169`), not over Tailscale. It has 4 cores and 15 GB, and Grok is not configured there.
- **Quotas, concurrency and usage logs:** not documented and not readable as `maxi`. Reading them needs `sudo -u svc-cliproxy` or the management key.
- **`heavy`:** two slots. The ServaRICA overflow hint appears after a heavy job waits 60 s, and that host only takes pushed, reproducible jobs. On Slimbook the agents slice is capped at `MemoryMax=22G` and `VITEST_MAX_WORKERS=3`.

## 6. Isolation

- **Installed versions:** Claude Code 2.1.319 and codex-cli 0.167.0.
- **Claude Code:**
  - Flags: `-p --output-format stream-json`, `--setting-sources`, `--settings`, `--mcp-config` plus `--strict-mcp-config`, `--plugin-dir`, `--disallowedTools`, `--tools`, `--disable-slash-commands`, `--no-session-persistence`, `--max-budget-usd`, `--bare`, `--restricted`.
  - `--max-turns` is not in `--help`, but the string is in the binary.
  - `--bare` skips CLAUDE.md, plugins and auto-memory, but it only accepts `ANTHROPIC_API_KEY` or an `apiKeyHelper`. That should work with the proxy token. Skills still resolve.
  - Skill injection: project `.claude/skills/` or `--plugin-dir`.
  - The binary also references `~/.agents/skills`, possibly as an import source. Not verified.
- **Codex:**
  - Flags: `codex exec --json -o last.txt -s workspace-write --ephemeral --ignore-user-config -m gpt-6.1-sol -c ...`.
  - `--ignore-user-config` still reads auth from `CODEX_HOME`.
  - Web search setting: the binary has `web_search` with values `disabled`, `cached` and `live`.
  - Skill locations: `$CWD/.agents/skills`, parent and repo-root `.agents/skills`, `$HOME/.agents/skills`, `/etc/codex/skills` (absent here), and bundled system skills. The binary still references `.codex/skills`, and Maxi's Nuxt skills sit in that legacy location.
  - Turn off bundled skills with `[skills.bundled] enabled=false`.
  - Skill injection: repo `.agents/skills`.

## 7. Versions (npm dist-tags)

| Package | Version |
| --- | --- |
| `nuxt` | latest 4.6.4 |
| `nuxt-nightly` | 5x `5.0.0-2611070044-e3875e8` |
| `nitro` | latest `3.0.261103-rc` |
| `nitropack` | 2.13.6 |
| `h3` | latest 2.0.8 |
| `vue` | latest 3.5.45, rc 3.6.0-rc.14 |
| `@nuxt/test-utils` | 4.3.4 |
| `@nuxt/ui` | 4.12.0 |
| `@nuxt/content` | 3.16.2 |
| `@nuxthub/core` | 0.10.12 |
| `@nuxt/image` | 2.2.1 |
| `@nuxtjs/i18n` | 10.6.0 |
| `@pinia/nuxt` | 1.0.3 |
| `nuxt-auth-utils` | 0.6.2 |
| `vite-doctor` | 0.1.2 |
| `nuxt-skill-hub` | 0.3.1 |

## Stale or wrong APIs in the skills

- `skills/nitro/references/core-routing.md:34` and `:203` say "H3 v2 dropped `readBody`". In h3 2.0.8, `readBody` and `readValidatedBody` are exported and not deprecated.
- `skills/nitro/SKILL.md:22` says `useStorage` became `useKV` (`nitro/kv`). `skills/nuxt/references/features-server.md:301-309` uses `useStorage` from `nitro/storage`. Both subpaths exist in nitro rc, so the two skills contradict each other.
- `skills/nuxt-content/references/rendering.md:15` uses `createError({ statusCode, statusMessage })`. Nuxt 5 expects `status`/`statusText`.
- `skills/nuxthub/SKILL.md:254-283` uses bare `cachedEventHandler`, `getKey: event => event.path` and `useStorage('cache')`. Nuxt 5 expects imports from `nuxt/server`, `nitro/cache` and `nitro/storage`, and `event.url.pathname`.
- `skills/nuxt-better-auth/references/server-auth.md:34,64,91`, `nuxt-ui/references/layouts/chat.md:67-68,87` (with `readBody` not imported) and `nuxt-content/references/querying.md:40-41`: handlers rely on auto-imports. Nuxt 5 expects explicit `nuxt/server` imports or `experimental.nitroAutoImports`.
- `skills/nuxt/references/features-composables.md:73` labels server `useRuntimeConfig()` as "Nuxt 4 / Nitro".
- `skills/nuxt/references/features-server.md:118` uses `getRequestHeader`, which h3 v2 deprecates in favour of `event.req.headers.get`. This is minor if `nuxt/server` wraps it.
- `skills/yapyak/references/nuxt.md:95` uses the `beforeResponse` hook, which Nitro v3 merged into `response`.
- `nuxt-skill-hub/nuxt-best-practices/rules/nitro-h3-patterns.md:14-17,30,46,79`, `server-routes-runtime-config.md:13-15`, `architecture-boundaries.md:17` and `data-fetching-ssr.md:118` use no imports and `defineCachedEventHandler`, which is Nuxt 4 style.

## Evidence and inference

**Evidence (I ran or read it):** file reads and greps; npm dist-tags; the h3 2.0.8 `.d.mts` and nitro rc exports from unpkg; the live MCP `tools/list`; the proxy `/v1/models` list and the 401 from the management endpoint; CLI `--help` output and binary strings; Codex skill locations from learn.chatgpt.com.

**Inference:**
- The `$CODEX_HOME/skills` legacy path is still loaded. Maxi's setup and the binary strings point that way, but I did not test it.
- Claude Code may read `~/.agents/skills`.
- `--bare` works with the proxy token.
- Doctor may fail to resolve the runtime graph for nightly aliases.
- Quota limits are weekly, based only on the timer's name.

## What would reverse these conclusions

- A newer nuxt-skills or antfu/skills bundle refreshed after 2026-11-05.
- Doctor's origin/main (22 commits ahead of the local checkout) adding payload or lazy-component rules, or changing the JSON schema.
- CLIProxy config showing per-account concurrency caps or a usage log.
- A Codex run in an isolated `CODEX_HOME` that still lists `~/.agents/skills` or loads memories.
- Nuxt 5 reaching `nuxt@latest` before the eval runs.
- Doctor running cleanly on a `nuxt-nightly@5x` fixture, or reporting the runtime as unresolved.

Key paths: `/home/maxi/nuxt/skills/skills/{nuxt,nitro,nuxthub,nuxt-content,nuxt-better-auth,nuxt-ui}`, `/home/maxi/nuxt-skill-hub/nuxt-best-practices/rules/`, `/home/maxi/nuxt-skill-hub/src/package-overrides.ts`, `/home/maxi/nuxt/vite-doctor/src/rule-packs/{nuxt,nitro}/`, `/home/maxi/nuxt/vite-doctor/src/cli-main.ts`, `/home/maxi/.claude/skills/fleet/SKILL.md`, `/home/maxi/.codex/skills/`, `/home/maxi/.codex/config.toml`.
