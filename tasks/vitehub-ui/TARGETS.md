# N1 targets

Written on 2026-11-13, before any N1 run. The commit that adds this file holds every target and every win rule. The task definitions hold the same numbers (`target` in each `task.ts`, `operateTarget` in `operate/tasks.ts`, `layoutTarget` in `layouts/score.ts`). Nothing here changes after the runs start. N1 is the first item of the [ViteHub UI plan v3](https://drop.vitehub.dev/d/71gdx24hacjg/vitehub-ui-pr-plan).

Agents: Opus 5.5 (Claude Code, medium) and Sol 6.1 (Codex, xhigh), through CLIProxy, as `cli/lib/agents.ts` sets them. Each task and variant runs 3 times per agent, unless the cost rule below cuts it to 2.

## Coding tasks

The score of a run is the share of probes it passes, and 0 when a gate fails. A task meets its target when the median score of each agent reaches the target.

| Task | Stack | Probes | Target | In N1 |
| --- | --- | --- | --- | --- |
| `ui-dialog-form` | Nuxt UI and `@vite-hub/ui` | 13 | 100% | runs |
| `ui-dialog-form-uisdk` | `@ui-sdk/vue` only, its docs and its skill | 13 | 100% | runs |
| `ui-stepper-kit` | `@vite-hub/kit` with Stepper (PR #4203, `a1b325f`) | 12 | 90% | runs |
| `ui-stepper-tabs` | `@ui-sdk/vue` only, Tabs | 12 | 90% | runs |
| `ui-settings` | Nuxt UI and `@vite-hub/ui` | 16 | 90% | not in N1 |
| `ui-data-table` | Nuxt UI and `@vite-hub/ui` | 11 | 90% | not in N1 |
| `ui-chat-approval` | Nuxt UI and `@vite-hub/ui` | 11 | 90% | not in N1 |
| `ui-agent-form` | waits for W3.3 | 9 | 85% | pending |

90% on 12 probes allows one miss. 100% on 13 allows none.

## Operate tasks

`ui-operate-settings` (a Switch, a Select and a RadioGroup, then Save) and `ui-operate-form` (a name, a Select, a Checkbox and a date, then Send) run on one Vite app built with `@ui-sdk/vue` 0.1.0-beta.2 and `web.css`. The same model gets the same prompt with one of two drivers:

- **browser**: the `agent-browser` 0.35.2 CLI and its skill, as ViteHub's `browser()` capability mounts them today;
- **bridge**: ui-sdk's agent bridge (`createAgent({ allow })` in the page), its `snapshot`, `query` and `act` tools with ui-sdk's own `agentTools` schemas, served by a stdio MCP server that runs each call in the page.

Measures, for each run:

- **success**: the app's server holds the right values (`check` in `operate/tasks.ts`), and the agent did not reach the app around its driver. What the agent says does not count.
- **page calls**: tool calls that read or change the page. Calls that load a tool's instructions (`agent-browser skills get`, `--help`, the skill file) are not page calls: the bridge's instructions come in its tool descriptions, which no call reads. All calls are recorded too.
- **page characters**: the characters of the page calls' results. All characters are recorded too.
- wall time of the agent CLI, tokens, and cost (models.dev list prices).

Target, from ui-sdk's claim (16 tool calls against 5, 39.8k characters against 6.8k), for each task and agent:

- the bridge succeeds at least as often as browser tools;
- the bridge's median page calls are at most half of browser tools';
- the bridge's median page characters are at most a third of browser tools'.

**Win rule.** For each task and agent, the bridge wins when all three hold. It wins N1's comparison when it wins all four task and agent pairs, and wins in part when it wins at least one.

**Stop rule 1.** Over all 12 runs per driver (2 tasks, 2 agents, 3 runs), the rule fires when the bridge has fewer successes than browser tools, or the same number of successes and a median of page calls that is not lower than browser tools'. Then the report says so at the top, and Maxi decides.

## Add a dialog: ui-sdk docs against Nuxt UI (C5)

- **C5 holds** ("passes with only ui-sdk's docs") when `ui-dialog-form-uisdk` meets its target: a median of 100% for each agent.
- **Win rule.** The variant with more runs at 100% (of 6) wins. Equal counts go to the higher median score over the 6 runs, and else it is a tie.

## Stepper against Tabs with a `linear` guard

- **Win rule.** The variant with more runs at or above 90% (of 6) wins. Equal counts go to the higher median score over the 6 runs. If that is equal too, Tabs wins: the kit holds only what ui-sdk lacks (C5), so Stepper must earn its place.

## Wire format for generated layouts (C4)

Plain model calls with each format's own prompt: json-render 0.21.0 (its catalog's generated prompt) and A2UI v1.0 (the A2UI eval's direct-JSON prompt with the basic catalog). 4 layout tasks, 2 models, 3 repeats: 24 first tries per format.

- **Target per format:** at least 90% validate against the format's schema and catalog, and at least 80% are first-try passes (valid, and every rubric check passes).
- **Win rule.** The format with more first-try passes wins. Equal counts go to A2UI, the plan's default (C4).

## Cost rule

If the full matrix looks above about $60, every task and variant runs 2 times per agent instead of 3, and the report says so.
