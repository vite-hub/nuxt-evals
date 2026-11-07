# ViteHub primitives and Console audit

> Research subagent report, 2026-11-07, for the eval plan. Facts were true on that date: check them again before you rely on one. Read-only research; nothing was run.

**Answer.** Build the platform as one Node-hosted ViteHub app (preset `node`, running on Slimbook or a VPS) with these pieces:

- **Agent** with `codexDriver()` and `claudeCodeDriver()`, routed through `cliproxy()` from `@vite-hub/gateways`. This is the agent under test.
- **Sandbox**, with the `trusted-host` runtime, or `crabbox` over SSH into a container you run, for isolation.
- **Workflow** on OpenWorkflow, or **Queue** with the local provider, for fan-out with concurrency caps.
- **Database** (SQLite or libSQL) and **Blob** (`fs` or S3) for artifacts.
- **`@vite-hub/browser`** with local Chromium for runtime checks.
- **`vite-hub/agent/eval`** (an evalite runner) as a scoring seed, plus `@vite-hub/ui` Trace and Diff components for the viewer.

ViteHub can wrap Claude Code and Codex. It does not only orchestrate around them.

The biggest gap is the public view. The Console is an operator tool. No public or anonymous read-only mode exists, and open PR #3548 refuses `auth: false` in production. The second gap is isolation: there is no Docker runtime, and the only runtime with real isolation that can reach `127.0.0.1:8317` is one you build yourself with crabbox or SSH. A third gap is that no LLM-judge, build or hidden-test grader exists.

origin/main is fresh (4763b4fba, 2026-11-07). There is no `box` package. It was removed in fdab212ab ("remove @vite-hub/box again").

## Per-package table

Test counts are `*.test.ts` files. Commit counts cover the last 30 days on origin/main.

| Package | What it is (public entry) | Fit | Evidence |
|---|---|---|---|
| agent | `defineAgent`, `codexDriver`/`claudeCodeDriver`, invocation journal, `vite-hub/agent/eval`. 308 tests, 338 commits | **Yes**, core | packages/agent/README.md:138-186, docs/content/docs/agents/evals.md |
| gateways | `cliproxy()`, `litellm()`, `anthropic()` and others. Routes Codex and Claude Code requests. 6 tests | **Yes** | packages/gateways/README.md:85 |
| sandbox | `resolveSandbox()` with `trusted-host`/`crabbox`/`cloudflare`/`vercel`/custom runtimes, plus Sandbox Tasks. 47 tests, 44 commits | **Partial**, see 1 | packages/sandbox/README.md |
| workflow | `defineWorkflow`, `runWorkflow`, `getWorkflowRun`. Cloudflare, Vercel, OpenWorkflow. 25 tests | **Yes** on Node (OpenWorkflow) | packages/workflow/README.md:22-120 |
| queue | `runQueue` with local, Cloudflare and Vercel providers, per-definition `concurrency`. 17 tests | **Yes**, single host | packages/queue/README.md:98-160, src/providers/local.ts:408 |
| schedule | Cron and process runtime | Low (nightly reruns only) | README:8,121 |
| database | Drizzle + `useDatabase()`: SQLite, libSQL, D1 | **Yes** (scores, run index) | README |
| blob | `fs`, R2, Vercel Blob, S3. `serve.anonymous` public route | **Yes** (transcripts, diffs, screenshots) | docs/content/docs/blob/configure.md:60 |
| kv | fs-lite, CF KV, Upstash, Deno KV | Minor (status flags) | README:55 |
| realtime | Yjs/TipTap collaborative documents only. "not a general-purpose WebSocket" | **No** for live run streams | packages/realtime/README.md:12 |
| browser | Cloudflare Browser Run definitions, plus low-level local Chromium with Playwright | **Partial** | packages/browser/README.md |
| workspace | File context with diff, snapshot and checkpoint | **Yes** (diff capture) | README:9,42 |
| shell | just-bash command analysis and execution | Low | README |
| runtime | Context, policy, trace, lease, execution-authority contracts | Indirect | README |
| ui | Vue Chat, Trace, Diff, FileTree components (Nuxt UI) | **Yes**, for the public viewer | packages/ui/README.md:8,18 |
| vite-hub | The distribution, the Console (`src/console/**`), Doctor rules. 264 tests, 439 commits | Console: **Partial** | packages/vite-hub/src/console |
| cli | `vitehub` commands (`agent eval`, `queue jobs`, `inspect`) | Yes (ops) | README |
| auth | Better Auth | Only to protect admin | README |
| env | Sealed Server Env | Yes (CLIProxy key) | README |
| connections | OAuth and API-key connections | Low | README |
| channels, email, content, source, rate-limit | Messaging, email, content, sources, budgets | No / minor | READMEs |
| internal | Private helpers | n/a | — |
| box | Does not exist on main | — | `git log`: fdab212ab |

Packages outside your list that are relevant: `presets`, `web-container` (in-browser previews), `forge`, and `gateways` (above).

## Deep findings

**1. Sandbox (box does not exist)**

- **Runtimes.**
  - `trusted-host`: local and unisolated (`network: "unrestricted"`, trusted-host.ts:113).
  - `crabbox`: runs on Linux SSH hosts.
  - `cloudflare`: Containers through a Durable Object.
  - `vercel`: microVM with `networkPolicy`, `cpu`, `timeout`, and `source: {type:"snapshot", snapshotId}` (src/vercel.ts:20-44).
  - Custom runtimes: you supply `prepare` and `open`.
- **No Docker runtime.** The support matrix lists Sandbox as unsupported ("—") for Node and self-hosted. That covers Sandbox Tasks. The Agent `sandbox` field does accept `trusted-host` and `crabbox`.
- **Long processes.** `session.spawn` exists, with streamed stdout and stderr and a 1 MiB limit per channel (`SANDBOX_R0159`). Exec takes a `timeout`. Sandbox Task timeouts go up to 2^31 ms.
- **Files.** `session.files` reads and writes binary files and lists directories recursively. Each session gets a private HOME and XDG dirs, plus `home.files` and `home.state` for per-run `.claude` and `.codex` config.
- **Project and toolchain pinning.** `checkout` pins the project to an exact SHA. `toolchain: "project"` provisions Node and pnpm with checksum verification.
- **Snapshots.** Only Vercel has native snapshot sources. Nothing generic snapshots a prepared project with `node_modules`. The custom runtime hook `refreshDependencies` is the nearest seam.
- **Limits.** `trusted-host` caps memory with cgroup v2 (`memoryMaxBytes`). It has no CPU or PID caps, and memory is the only `resources` field (src/index.ts:323).
- **Network to the proxy.** `trusted-host` reaches `127.0.0.1:8317` directly. Crabbox reaches it with `network: "direct"` or tunnels. Vercel and Cloudflare would need the public `ai.onmax.me`.
- **SSH transport.** `vitehub sandbox serve` and `sshLaunch` (`@vite-hub/sandbox/ssh`) let a Docker container with sshd act as the runner. This is the practical isolated path.

**2. Agent**

- A ViteHub Agent is a definition with a driver (model, `run`, `ask`, or a provider driver), capabilities, a workspace and channels.
- `codexDriver()` and `claudeCodeDriver()` run the real Codex (`@openai/codex@0.149.1`) and Claude Code (`@anthropic-ai/claude-agent-sdk@0.3.246`, which ships the `claude` binary) through `@t3tools/provider-runtime` (src/provider-agent.ts:32).
- `driver.gateway: cliproxy()` writes the Codex `base_url` provider config or the Claude `ANTHROPIC_*` variables. It reads `CLIPROXY_URL` and `CLIPROXY_API_KEY` and does not forward ambient variables (agent-drivers.md:180-203).
- With `sandbox` set on the Agent, the provider runtime stays in the ViteHub process and only the CLI command runs in the Sandbox. That combination rejects `launch` and `credentials`, and each session lasts one invocation (agent-drivers.md:288).
- `permissions: "allow-all"` allows headless runs. `driver.capacity` and `createProcessAgentCapacity` give concurrency and FIFO admission within one process.
- **Transcript.** The journal stores normalized assistant, reasoning, tool, approval, usage and error events. The defaults are 32,768 observations and a 16 MiB cap per invocation, and you can raise them. Optional exports go to evlog and PostHog. The Console renders Codex session steps (#3549).
- **Evals.** `defineEval` takes scenarios, scorers and variants. A variant can swap the model or instructions of a Codex or Claude Code driver. The runner is `vitehub agent eval` with `maxConcurrency`.
- **Limit:** pinned CLI versions. A "tooling setup" that changes MCP servers or the CLI version needs a separate Agent Definition or `providerSettings` (agent-drivers.md:262).

**3. Queue, Workflow, Schedule**

- **Queue, local provider.** Jobs are files in `.vitehub/data/queue`. Failed jobs retry after 1, 2 and 4 s, 4 attempts in total, then become dead jobs. Delivery is at least once, with per-definition `concurrency` (local.ts:408). Durability is single-host with no inter-process lock. I found no handler timeout, so a 30-minute handler is allowed, and a restart reruns it.
- **Workflow on Node.** OpenWorkflow uses SQLite or Postgres, needs one long-lived worker (`startOpenWorkflowWorker`) with `worker.concurrency`, and supports cancel. `getWorkflowRun` returns run and step state, attempts and failures. The step API is `steps` from numbered step files plus provider `step.do(name, {retries}, fn)` and `step.sleep` (src/types.ts:109-145). It has no built-in fan-out primitive: you fan out by calling `runWorkflow` many times.
- The support matrix lists "Vercel Workflow" for Node, which contradicts the README's OpenWorkflow statement. This is a docs inconsistency.
- In dev, everything runs in the dev server.

**4. Storage and live status**

- Blob and Database are a good fit. Blob `serve` with `authorize` plus `anonymous: true` can serve artifacts publicly.
- Realtime is not an event bus.
- Live status today goes through `streamAgent()` (an AI SDK UI message stream over SSE) or through polling the journal.
- No primitive pub/sub or SSE broadcast of run events exists.

**5. Console**

- It lives in `packages/vite-hub/src/console/**` and is mounted at `/_vitehub`, with RPC at `/_vitehub/rpc/__call` and MCP at `/_vitehub/mcp`.
- Its sections are Auth, Env, Connections, Agents (sessions, transcripts, workspace diffs, cancel), Channels, Usage, Logs, Blob, Databases, KV, Sandbox Tasks, Workspaces, Workflows, Queues, Schedules and others (development/console.md). It shows no live Sandbox sessions.
- **Auth** is `auth: 'app'`, Console Auth (GitHub), Cloudflare Access, or `auth: false` + `authorize(request)`. `authorize` can return read-only grants such as `{ sections: ['agents:read'] }`.
- **No public mode.** I found no "public", "share" or anonymous Console mode in the docs or source. A grant for anyone is possible in theory, but it would expose prompts and env metadata and the whole operator UI. PR #3548 (open) refuses `auth: false` in production.
- **Recent work** is the Operations endpoint plus a hosted multi-project Console at console.vitehub.dev, with OAuth PKCE and project linking. These are open PRs #3515 #3525 #3536 #3540 #3548 #3550 #3551. Maxi approved the design on 2026-11-06, per memory `console-placement-design.md`.
- **Deploy.** The Console runs inside the app. A hosted Console deploy from CI is pending (#3536).

**6. Browser**

- Browser Definitions and actions are Cloudflare Browser Run only.
- On Node, `createBrowser({ provider: localBrowser({ executablePath }) })` + `playwright()` gives a full Playwright page. You can collect console messages, network requests and payload sizes yourself.
- It is usable for grading, but it has no hydration-warning, request-count or payload helpers, and it adds no sandbox around Chromium.

**7. Existing eval and bench code**

- Only `vite-hub/agent/eval`: packages/agent/src/eval.ts and evalite-runner.ts, with scorers `textContains`, `callsTool`, `staysUnderTokenBudget`, `doesNotLeakSource` and custom scorers. It runs inline.
- There is no LLM judge, build, test or diff grader, and no `bench` scripts on main. `scripts/` has only `comments-demo.mjs`.
- `decisions/test/portal-oracle.test.ts` is unrelated.
- **Vite Doctor.** `vitehub()` and `vite-hub/nuxt` register VHUB rules automatically when `vite-doctor` runs (docs/content/docs/reference/doctor-rules.md). This is usable as a static-rule grader for the Nuxt tasks.

**8. Deploy targets**

- Cloudflare, Vercel, Netlify, Deno, Nitro, and Node/self-hosted (support-matrix.md).
- Provider drivers need a Node host. A Worker build fails with `AGENT_B0019`.
- A long-running Node process is first class: `createProcessAgentHost`, a SIGTERM drain, `/api/_vitehub/ready`, cgroup-aware capacity, and `vitehub deploy` local by default (#3528 is open).

## Gaps, as primitive proposals

1. **Public read-only Console view, or "share" grants.** Owner: `vite-hub` console. An anonymous, redacted, read-only role per section or per resource, for example Agents and Workflows reads with env, prompts and secrets hidden. It should hold the production rule from #3548 without needing `auth: false`.
2. **Container sandbox runtime** (`runtime: { kind: "docker" }` or OCI). Owner: `sandbox`. Today isolation on Slimbook means building crabbox or SSH on top of a container yourself.
3. **Generic prepared-project snapshot and restore**, a cache of a pinned checkout with `node_modules` keyed by lockfile hash. Owner: `sandbox`. Today only Vercel has `snapshotId`.
4. **CPU and PID limits** for `trusted-host` cgroups. Owner: `sandbox`. Today only memory is capped.
5. **Run-event stream and pub/sub** for live viewers (SSE from the invocation journal). Owner: `agent` journal or a new events primitive. Realtime does not cover it.
6. **Graders for evals:** an LLM-judge scorer through a gateway, plus command, diff and test scorers that run in a Sandbox. Owner: `agent/eval`. A browser scorer could come from `browser`.
7. **Fan-out with a global concurrency cap across processes.** Owner: `workflow`. Today the caps are per process or per queue definition.
8. **Browser runtime-check helpers** (console errors, hydration warnings, request count, transfer bytes) and local Browser Definitions. Owner: `browser`.

## What is evidence and what is inference

**Evidence:** the README, docs and source lines cited above, the open PR list from `gh`, and the commit dates.

**Inference:**
- That a provider driver plus `trusted-host` reaches CLIProxy on loopback. This follows from `network: "unrestricted"`, but I did not run it.
- That 30-40 minute runs work. No timeout caps were found on spawn or the local queue, but nothing was tested.
- That the Console Agents view updates live. Cancel exists, but I don't know whether it polls or streams.
- Vercel Sandbox maximum run time. It is not in the repo.
- That a custom Docker-over-SSH runtime fits well. It follows from the README seams.

## What would reverse the recommendation

- If `claudeCodeDriver` can't carry the per-setup MCP or tooling variation you need (it pins the SDK version), the agent under test leaves the Agent primitive. You would then run raw `claude -p` and `codex exec` through `sandbox.spawn` and use ViteHub only for orchestration and recording.
- If the hosted Console with OAuth tokens lands with a public-grant model, gap 1 becomes configuration.
- If you need hard isolation without building a crabbox or SSH container, runs move to plain local Docker, with ViteHub recording only.
