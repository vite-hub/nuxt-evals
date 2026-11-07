# External eval prior art

> Research subagent report, 2026-11-07, for the eval plan. Facts were true on that date: check them again before you rely on one. Read-only research; nothing was run.

I'd build this on the format nuxt.com/evals already uses, `vercel/nuxt-evals` running on `@vercel/agent-eval`, rather than invent a new one. The pieces it's missing are graders, not a new harness. For the Nuxt team, the honest question is "does the plugin get used, and when it is used, does the code choose better primitives on Nuxt 5 APIs the models don't know yet?", and the eval should report both parts.

## Answer

Keep the hidden `EVAL.ts` plus `build` gate as the pass condition. Add four things on top:
- **Rule score:** structural checks on the Vue and TS syntax trees, not regex.
- **Runtime score:** run the built server, drive it with Playwright, and count hydration warnings, duplicate `/api` requests, payload size, and state leaking between two requests with different cookies.
- **Invocation telemetry:** did the agent call the Nuxt MCP, and did it load the skill?
- **One judge:** a single pinned, blind judge for the parts rules can't check.

Run the setups as separate experiments (bare / MCP + core skill / + module skills), with at least 5 runs per task and `earlyExit: false`. Report the mean per-run score and pass^k, not pass@4.

**Biggest limitation:** the "right primitive" rules are the Nuxt team's own opinion of what is idiomatic. If the rubric or the rules come from the skill being tested, setups B and C win by construction. Write the rubric from the Nuxt docs, and freeze it before the skill is written. Second limitation: frontier models may have little room left to improve. Next.js top models score 100% both with and without AGENTS.md ([nextjs.org/evals](https://nextjs.org/evals)), so you need Nuxt 5, h3 v2 and Nitro v3 tasks where the bare model actually fails.

## How others do it

**[vercel/nuxt-evals](https://github.com/vercel/nuxt-evals)**
- **Task layout:** each task is a full Nuxt app in `evals/nuxt-NNN-*/` with `PROMPT.md`, a hidden `EVAL.ts` (vitest), `package.json` with a `build` script, and broken starter code.
- **Grading:** `EVAL.ts` is mostly regex on source text. It already checks for the right primitive and rejects anti-patterns (e.g. 000 requires `use(Lazy)?(Fetch|AsyncData)` and no `onMounted`; 016 rejects `{{ new Date }}`). There is no runtime check, no rendering and no judge. `scripts: ['build']` must also pass.
- **Attempts:** `runs: 4, earlyExit: true`. The export notes that the per-run pass rate is skewed by the early exit and that `firstRunSuccess` is the unbiased number.
- **Agents:** Claude Code, Codex, OpenCode and Cursor through the Vercel AI Gateway, all in Vercel Sandbox.
- **Fixtures** pin `nuxt ^4.3.1`, so they are not Nuxt 5.
- **Publishing:** `pnpm export-results` writes `agent-results.json`, which is copied by hand into the nuxt.com repo. The page shows "Success Rate" (pass@4) and "First-Try Rate" (last run 2026-10-15; Opus 5.5 at 100% / 97%).
- **There is already an MCP setup:** `experiments/mcp/claude-sonnet-4.5-with-mcp.ts` adds `nuxt.com/mcp` and `ui.nuxt.com/mcp` with `claude mcp add`. No results for it are published.
- **Why it applies:** same task format, same publishing path, and it already holds right-vs-wrong-primitive tasks. So your suite can feed nuxt.com/evals.

**[@vercel/agent-eval](https://github.com/vercel-labs/agent-eval)** already has most of what you need:
- `setup` hook to install MCP servers and skills
- `editPrompt`
- `verifier: 'separate'`: grades in a fresh sandbox the agent never touched
- `disableBundledSkills`: turns off skills shipped with Claude Code or Codex
- `judge: {agent, model}` to pin one judge. **By default the judge is the same model as the agent under test, so it grades itself.**
- `expect(transcript).toContainText(...)` and `results.o11y`
- `onRunComplete` to attach your own scores
- The README already gives "with MCP vs control" as its main A/B example.

**Telemetry gap I found:** the Claude Code transcript parser maps tool names to fixed names and sends anything else to `'unknown'` ([parsers/claude-code.ts](https://github.com/vercel-labs/agent-eval/blob/main/packages/agent-eval/src/lib/o11y/parsers/claude-code.ts)). So `mcp__nuxt__*` calls and the `Skill` tool are not counted. You have to parse the raw transcript yourself.

**[next-evals-oss](https://github.com/vercel/next-evals-oss)** publishes a Base and an AGENTS.md experiment for each model, shown as a second column on nextjs.org/evals. It also has:
- the suite pinned to a commit (`eval-suite-ref.txt`)
- grader overrides that were reviewed separately
- results reused unless the task or config changed
- effort set to "high, not ceiling"

This is the closest precedent for showing setup columns on a public board.

**[Vercel, "AGENTS.md outperforms skills"](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)**
- It tested Next.js 16 APIs that are not in training data. Pass rates: baseline 53%, skill 53%, skill with an explicit instruction 79%, compressed 8 KB AGENTS.md docs index 100%.
- The skill was never invoked in 56% of cases.
- Results changed with the wording of the instruction ("invoke first" missed config changes).
- The post does not say the task count, runs or model.
- **What this means for you:** setups B and C must log whether the skill or MCP was actually used.

**[sveltejs/svelte-evals](https://github.com/sveltejs/svelte-evals)** is the closest match to your three setups. It also runs on agent-eval:
- **Experiments:** `basic`, `mcp`, `mcp-prompt`, `skill-bp`, `skill-bp-mcp`, `skill-cw`
- **Grading:** a hidden `EVAL.ts` with static checks (e.g. `$derived` but not `$derived.by`), plus browser component tests and the build
- **Setup:** separate verifier, sandbox image pinned by digest
- **Weakness:** `runs: 1` and OpenCode only

**[angular/web-codegen-scorer](https://github.com/angular/web-codegen-scorer)** grades quality, not pass/fail:
- **Checks:** each check has an impact level and a `scoreReduction` percentage. They cover the build, runtime exceptions while the app is served, axe accessibility, CSP and security, and an LLM code-quality rating worth up to 30%.
- **Runners:** `claude-code`, `codex` and `gemini-cli`, with an `--mcp` flag.
- **Weakness:** the rating is a holistic 1–10 score, not a check for a specific primitive.
- **Why it applies:** a good model for a multi-part score that subtracts points per problem.

**[Laravel Boost Benchmarks](https://laravel.com/blog/which-ai-model-is-best-for-laravel)**
- 17 tasks, Pest tests plus architecture tests, OpenCode, 6 models, with and without Boost. Boost raised or matched every model (haiku +36/315 tests, sonnet +1).
- **But it was a single run.** They report "haiku 4.5 improved from 7/19 to 17/19 … just by running the same evaluation again", and Codex flipped on 4 tasks between identical runs. They call the results "directional".
- The harness is not open source. I found no `eval`/`bench` folder in `laravel/boost`.
- The [follow-up post](https://laravel.com/blog/idiomatic-laravel-ai-coding-agents) (2026-07-24) says the suite is saturated. It moves to "correct code per token" and a reference-free LLM judge whose rubric comes from **their own best-practices skill**.
- **So for "does Laravel have evals?":** yes, but they are weak evidence.

**[Convex evals](https://github.com/get-convex/convex-evals)**
- **Setups:** guidelines vs `no_guidelines` vs `no_guidelines_with_web`.
- **Grader rule:** "Merely finding an identifier, import, or correctly shaped call is not enough". Each grader must be checked against both equivalent valid answers and plausible wrong answers.
- **Limit:** single-shot API calls, not agents. Their AI grader is turned off.

**[Nolan Lawson, Oct 2026](https://nolanlawson.com/2026/10/28/the-ai-cost-of-javascript-frameworks/)**
- Opus 5.5, 5 runs per framework, with official MCPs and skills installed.
- "For Nuxt, the MCP was never used by the agents." Next.js skills were used in 1/5 runs, the Svelte MCP in 5/5.
- This is likely where "the Nuxt MCP is rarely used" comes from.

**Anthropic guidance**
- [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator): runs with and without the skill side by side, reports mean ± stddev, flags assertions that pass whatever the setup, offers blind comparison, and has a separate trigger eval (each query run 3 times). It notes "Claude has a tendency to undertrigger skills."
- [Demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): explains pass@k vs pass^k, a clean environment per trial, "grade what the agent produced, not the path", and calibrating the LLM judge against humans.

**SWE-bench / [Harbor](https://github.com/harbor-framework/harbor)**: hidden FAIL_TO_PASS and PASS_TO_PASS tests, a container per task, Claude Code and Codex run headless. They support the "hidden tests plus clean grading sandbox" pattern, which agent-eval's separate verifier already covers.

**Judge bias**
- Self-preference: [Panickssery et al. 2024](https://arxiv.org/abs/2404.13076).
- Position, verbosity and self-enhancement bias: [Zheng et al. 2023](https://arxiv.org/abs/2306.05685).
- Paired, clustered standard errors for comparing two setups on the same questions: [Miller 2024](https://arxiv.org/abs/2411.00640).

## Common practice vs. what fits our case

Common practice:
- binary pass@k
- regex checks on source
- 1–4 runs
- self-graded or no judge
- no record of whether the tool was used

What fits:
- **Gate:** build plus hidden behavior tests. Score only runs that pass the gate, and report the gate rate separately.
- **Rules:** checks on the syntax tree for each pair of right and tempting-wrong primitive, e.g. `readValidatedBody`/`getValidatedQuery` vs manual parsing, `useFetch` vs `$fetch` in setup, `useState` vs a module-level `ref`. Validate each rule Convex-style against valid variants and plausible fakes.
- **Runtime:**
  - hydration-mismatch console warnings
  - number of `/api` requests per navigation (a duplicate fetch)
  - `__NUXT_DATA__` payload bytes
  - two concurrent requests with different cookies (state leak)
- **Telemetry, read from the raw transcript:** `mcp__nuxt*` calls, `Skill` tool calls or reads of `SKILL.md`, tokens, time. Report results two ways: for every run in a setup, and only for runs where the tool was actually used.
- **Judge:** one fixed model for all setups and both agents. Show it two answers side by side, not one score at a time, with labels removed and order swapped. Use a family that isn't being tested, or average Claude and GPT judges. Check it against roughly 50 human labels.
- **Prompts:** don't hint at the primitive in prompts that measure unprompted selection (Convex's "over-specification"). Several nuxt-evals prompts say "fix it following Nuxt best practices".
- **Optional fourth setup:** an AGENTS.md docs index. Vercel's result says it's the control that would refute "skills are needed".

## Disagreements between sources

- **Does the tooling get used?** Vercel: skill not used in 56% of runs. Lawson: Nuxt MCP 0/5 but Svelte MCP 5/5.
- **Does it help?** Laravel says Boost helps every model, from single runs with admitted flips. Lawson suspects MCPs and skills "may be doing more harm than good". The [ACES paper](https://arxiv.org/abs/2608.20614) reports a positive effect in 72.8% of 947 paired cases, mean lift 0.21.
- **Grade the path?** Anthropic says grade outcomes, not paths. Laravel plans to assert tool and skill calls, and agent-eval supports transcript asserts. My middle ground: log invocation as a diagnostic, never as a pass condition.
- **Is regex enough?** nuxt-evals and svelte-evals rely on identifier regex. Convex says that isn't enough.
- **Where does the rubric come from?** Laravel takes it from its own skill. That is circular for comparing setups.
- **Which metric?** Vercel and Nuxt publish pass@4. Anthropic and skill-creator favor mean ± stddev and pass^k.

## Evidence vs. my inference

**Evidence:** everything quoted or linked above, including the nuxt-evals repo contents, the agent-eval parser gap, and the published numbers.

**My inference:**
- The rubric-circularity risk.
- That gains will show mostly on post-cutoff Nuxt 5, h3 v2 and Nitro v3 APIs. Vercel and Laravel both saw gains on new or complex APIs, not simple ones.
- **Sample size:** to detect about a 15-point difference in the per-run rule-violation rate near 50%, a two-arm comparison needs roughly 170 runs per setup per model. Pairing by task helps, so about 30 tasks × 6 runs is a starting point. Settle the number from the variance in a pilot.
- That Codex shows skill use as file reads or shell commands, not a `Skill` tool. I haven't checked this.

## What would reverse this

- **Bare Opus 5.5 and Sol 6.1 already pass at least about 95% of rule and runtime checks on Nuxt 5 tasks:** no room to improve, and the team's "models do fine" holds.
- **MCP or skill use stays near 0 even with the plugin installed:** recommend passive context (AGENTS.md or `llms.txt` index) instead of a plugin.
- **Judge-human agreement is low:** drop the judge and publish rules plus runtime only.
- **The nuxt.com owners won't accept columns per setup:** run the suite standalone. It stays agent-eval compatible either way.
