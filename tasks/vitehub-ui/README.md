# ViteHub UI first-try tasks

Five small tasks that measure whether a coding agent uses ViteHub UI correctly on the first try. The vitehub AGENTS.md says: "If an Agent cannot use a ViteHub API correctly on the first try, the API is wrong." Each task has a target score, written down here before any run. This is W0.3 of the [ViteHub UI plan](https://drop.vitehub.dev/d/71gdx24hacjg/vitehub-ui-pr-plan): today's stack (Nuxt UI and `@vite-hub/ui`) gets a baseline now, and W5.4 is done when each task reaches its target on the new stack (`@vite-hub/kit`, the registry and the catalog).

## The tasks

| Task | What the agent builds | Probes | Target | Baseline |
| --- | --- | --- | --- | --- |
| `ui-dialog-form` | A "New project" dialog with Name and Visibility, keyboard accessible, that closes on submit | 13 | 100% | today's stack |
| `ui-settings` | Project settings with General, Members and Danger zone tabs, a switch, a select and a destructive confirmation | 16 | 90% | today's stack |
| `ui-data-table` | A deployments table, sortable by two columns and filterable as you type, with an empty state | 11 | 90% | today's stack |
| `ui-chat-approval` | A chat whose `archiveProject` tool waits for the user's approval, rendered with `@vite-hub/ui` parts | 11 | 90% | today's stack |
| `ui-agent-form` | The Agent answers with a form, the user sends it, and the Agent reads the values | 9 | 85% | none until W3.3 |

The score of a run is the share of probes it passes, and 0 when a gate fails (`score()` in `cli/lib/grade.ts`). A task meets its target when the median of 3 runs of each agent in the baseline set (Opus and Sol) reaches it. 100% on 13 probes allows no miss; 90% on 11 or 16 probes and 85% on 9 allow one. The dialog is the smallest task, so any miss there means the parts got in the way.

`ui-agent-form` has `pending` set, so `pnpm evals run ui-agent-form` refuses to start. It needs W3.3 (`defineAgent({ ui: true })`), which doesn't exist yet. That PR pins the fixture to a ViteHub build with it, adds `fileBug()` and `GET /api/bugs` to the store, and teaches the scripted model to answer "report a bug" with the form. Its prompt and probes are here now, so the target is fixed before the feature exists.

## What every task gets

`fixture/` is one Nuxt 5 app, Acme Console, that every task starts from (`fixture: "vitehub-ui/fixture"` in each `task.ts`). Nuxt `5.0.0-2611070044-e3875e8` (nightly), Nitro `3.0.261103-rc`, h3 `2.0.8`, `@nuxt/ui` `4.12.0`, `vite-hub` and `@vite-hub/ui` from the pkg.pr.new build of `1ed1c37` (the site's pin), `ai` `7.0.130` and `@ai-sdk/vue` `4.0.130`, pinned with a lockfile. It has:

- a Projects page and a layout;
- `server/utils/store.ts`: three projects, their members and 48 deployments, seeded, in memory;
- a JSON API for them in `server/api`;
- `server/utils/model.ts`: a scripted AI SDK model, so the chat task needs no API key and answers the same way every time.

The prompts state a product need, name the URL, the labels and the API the grader uses, and ask for "the UI parts the project already has". They never name a component.

## How the probes grade

`harness.ts` builds the agent's app in a copy (`nuxt build` through `heavy`), starts `.output/server/index.mjs` on a free port in 4810 to 4889, and opens pages in headless Chromium (`playwright-core` from `cli/`). A failed build fails every gate and runtime probe with the build's first error line. Probes find controls by role and accessible name, and use them with the keyboard: focus, then Enter, Space, arrows, Tab and Escape. Any library, or plain HTML, that behaves right passes: a radio group, a select or a switch for Visibility; a native `<select>` or a listbox for Default branch; a sort button or a sort menu; a confirmation that asks for the project's name.

Every task also has three shared probes (`probes.ts`):

- `no-div-buttons` (static): no click or key handlers on `div`, `span`, `li`, `tr`, `td`, `th` or `img`, and no `role="button"` on them, in the files the agent changed.
- `no-hand-rolled-focus-trap` (static): no Tab key handling, focusable-element queries or focus-trap packages.
- `no-page-errors` (runtime, last): no uncaught error, console error or Vue warning on any page the probes opened. The 400 and 409 answers that the probes cause on purpose don't count.

The data table probes know the expected rows because they import the fixture's seeded store.

## References

`references/<task>/reference/` is a hand-written solution on today's stack, laid over the fixture. It must pass every probe. `wrong-*` folders are laid over it and change only what a tempting wrong solution gets wrong: hand-made dialogs, tabs and tables with clickable divs, a Tab trap, filtering on Enter, and a chat without approvals. `trap-*` is a right solution that today's stack breaks.

```sh
node tasks/vitehub-ui/references/check.ts ui-settings             # reference and every wrong-* and trap-*
node tasks/vitehub-ui/references/check.ts ui-settings --runs 3 reference
```

It prints one line per probe and a table, and exits with 1 when the reference misses a probe. No agent runs.

On 2026-11-13 each reference passed every probe in 3 runs. The wrong solutions scored 3/13 (dialog), 6/16 (settings), 5/11 (table) and 6/11 (chat), each failing the probes it targets. `trap-server-rendered` scored 2/11: its build fails, so only the static probes pass. A grading takes about 15 to 20 s with a warm install cache.

### What the references found in today's stack

Each of these cost the reference a probe on its first try. An agent will meet the same ones.

- **ViteHub UI's chat parts break `nuxt build` when they render on the server.** `@vite-hub/ui` loads Nuxt UI components with dynamic imports (`src/internal/nuxt-ui.ts`), among them `EditorDragHandle.vue`, which imports the `#build/ui/editor-drag-handle` alias. Nitro refuses it: "Vue app aliases are not allowed in server runtime". `build.transpile: ["@vite-hub/ui"]` moves the failure to shiki's `onig.wasm`. The reference renders the chat in a `.client.vue` component, as the site does; `trap-server-rendered` is the same chat in the page and fails the build. vite-hub/vitehub main (`89115ba`) has the same dynamic imports.
- **Nuxt UI's table sets `aria-sort` only for columns with `enableSorting: true`.** Sorting works without it, so the header never says which way the table is sorted.
- **`UTabs` selects nothing when the items have a `value` and the tabs get no `default-value`.** The first panel stays empty until the user picks a tab.

## The ui-sdk and kit tasks

Plan N1 asks the same questions of the new stack: ui-sdk (`@ui-sdk/vue` and `@ui-sdk/core` `0.1.0-beta.2`), and `@vite-hub/kit`, which adds the parts that ui-sdk lacks.

| Task | Fixture | What the agent builds | Probes | Target |
| --- | --- | --- | --- | --- |
| `ui-dialog-form-uisdk` | `fixture-uisdk` | The `ui-dialog-form` dialog. Same prompt, except the line that names the stack, and the same probes (imported from `ui-dialog-form/task.ts`) | 13 | 100% |
| `ui-stepper-tabs` | `fixture-uisdk` | A checkout on `/checkout` in three steps (Shipping, Payment, Review) that never goes to a step the person has not reached, and places the order | 12 | 90% |
| `ui-stepper-kit` | `fixture-kit` | The same checkout, with the same prompt (except the stack line) and probes | 12 | 90% |

All three tasks have `skills: ["node_modules/@ui-sdk/core/skills/ui-sdk"]`: the skill that `@ui-sdk/core` ships. After the install, `installSetup` copies each skill folder of the task from the working copy into the agent's skills folder, in every setup. So for these tasks setup A has one skill: Claude Code gets the Skill tool and its bundled skills, and the audit allows them.

### The fixtures

`fixture-uisdk/` is Acme Console with the same Nuxt, Nitro, h3, Vue, vue-router and zod pins, the same seeded store and API, and the same layout and Projects page, in plain HTML and CSS. The UI is `@ui-sdk/vue` and `@ui-sdk/core` `0.1.0-beta.2`, with ui-sdk's stylesheet (`@ui-sdk/core/web.css`) and the `@ui-sdk/vue` Nuxt module, which auto-imports every part. It has no Nuxt UI, `@vite-hub/ui`, Tailwind, `vite-hub`, `ai` or scripted model: the server needs none of them, and no task here has a chat. It adds `POST /api/orders` (`{ address, cardName }`) and `GET /api/orders`, in memory, for the checkout. Its `AGENTS.md` is the text that ui-sdk's docs tell Vue users to give an agent ("Build with an Agent" in `docs/agents.md`). ui-sdk `0.1.0-beta.2` came out on 2026-11-13, so `pnpm-workspace.yaml` excludes it from pnpm's minimum release age.

`fixture-kit/` is `fixture-uisdk/` plus `@vite-hub/kit` from the pkg.pr.new build of vite-hub/vitehub#4203 (`a1b325f`), with the kit's Nuxt module (`@vite-hub/kit/nuxt`) in place of ui-sdk's. Only `package.json`, the lockfile, `nuxt.config.ts`, `AGENTS.md` and `README.md` differ; keep the other files the same in both. The kit's tarball ships its `README.md` and no docs folder, so its `AGENTS.md` points to `node_modules/@vite-hub/kit/README.md` for what the kit adds, and to the ui-sdk docs for the rest. Neither fixture's docs name a stepper.

### The stepper probes

`stepper-probes.ts` has the probes of both stepper tasks. The step list is a tablist with a Shipping tab, or else the smallest element around the `aria-current="step"` item that names all three steps. Probes match a step by a name that starts with it ("Shipping", "1. Shipping"), so "Back to Shipping" is not a step.

- `build` and `page-responds` (gates): the build passes and `/checkout` answers 200.
- `step-semantics`: the list shows the three steps and marks Shipping as current, with `aria-current="step"`, or with a selected tab whose `aria-controls` points to the tabpanel with Address.
- `linear-by-click`: from an empty Shipping step, a click on Review, then on Payment, neither shows that step nor makes it current.
- `linear-by-keyboard`: from the Shipping step, ArrowRight, ArrowDown or End, then Enter or Space, never selects another step.
- `continue-moves-focus`: Continue with Address filled makes Payment current. Focus goes to the Payment panel, its heading or its step, or a live region names Payment. Focus on the page body fails.
- `back-keeps-values`: from Payment, the step list or a Back button returns to Shipping with the keyboard, and the Address is still there.
- `one-tab-stop`: at most one step of the list is in the Tab sequence, on Shipping and again on Review, and Tab and Shift+Tab leave the list.
- `place-order`: Review shows both values, and Place order saves one order with them (`GET /api/orders`).
- The three shared probes.

### What the references found in ui-sdk and the kit

- **The ui-sdk dialog passed all 13 probes on the first try.** `Dialog`, `Field`, `Input`, `RadioGroup` and `Button` give the role, the name, the focus trap, Escape, focus return and the field errors. The API's message shows through `<Field :invalid>` and `<FieldError match>`. No `trap-*` was necessary.
- **The kit's `Stepper` is linear by default, but linear lets a person go one step ahead without a check.** From an empty Shipping step, a click on Payment, or ArrowRight and Enter, opens Payment. The reference sets `disabled` on each `StepperItem` after the furthest step reached. `wrong-linear-default` is the reference without it.
- **ui-sdk has no stepper.** `Tabs` with `disabled` on the tabs not reached passes every probe: a disabled tab takes focus from the arrow keys, as the tabs pattern asks, but never gets selected.
- **When Continue sits in the step that it leaves, the step goes and takes focus with it.** Both references move focus to the heading of the new step (`tabindex="-1"`).
- **The `@ui-sdk/vue` Nuxt module imports `@nuxt/kit`, an optional peer.** With `nuxt-nightly`, pnpm still links it to `@nuxt/kit-nightly`, so the fixtures need no extra dependency.

The wrong solutions fail the probes they target. `ui-stepper-tabs`: `wrong-click-ahead` (tabs without `disabled`) scored 10/12, and `wrong-div-stepper` (clickable divs without `aria-current`) scored 7/12. Each reference passed every probe in 3 runs. `ui-stepper-kit`: `wrong-linear-default` scored 10/12, and `wrong-all-tabbable` (a list of buttons, each a tab stop) scored 11/12.

## Operate tasks

Plan N1 also asks whether an agent works a running UI better through ui-sdk's agent bridge than through browser tools (C2). `operate/` holds that eval. The agent writes no code here: it changes the state of a running app, and the grader reads that state from the app's server.

- `operate/app/`: a Vite app built with `@ui-sdk/vue` `0.1.0-beta.2` and `web.css`. `/settings` has a project name, a Select of 12 regions, a Visibility RadioGroup, five Switches, a members table and Save. `/invite` has Full name, a Role Select, a Start date DatePicker, a Checkbox, an optional note and Send invite. `src/agent.ts` calls `createAgent({ allow })` from `@ui-sdk/core/agent` before the app mounts, and puts the bridge and ui-sdk's `agentTools` on `window`.
- `operate/server.ts`: serves the build and a JSON API with state in memory. Each run gets its own server.
- `operate/bridge-mcp.ts`: a stdio MCP server. It opens the page in headless Chromium, lists ui-sdk's own `agentTools` (`snapshot`, `act`, `query`) as its tools, runs each call with `page.evaluate`, and logs each call with the characters it returned.
- `operate/tasks.ts`: the two tasks, their prompts, the state check and the target.

`pnpm evals operate <task|all> --driver browser|bridge|both --agent opus|sol --repeat 3 --parallel 3` runs them, and `pnpm evals operate-report` prints the medians. Runs go to `cli/.data/operate/<id>/`. The **browser** driver gets `agent-browser` 0.35.2 (the version ViteHub's managed `browser()` runtime pins) on PATH with its own session, and its skill as ViteHub writes it, with Claude Code's Bash, Read and Skill tools or Codex's shell. The **bridge** driver gets only the MCP server: no Claude Code tools, and no Codex shell. The prompt is the same for both, plus one sentence that names the tools.

## Layout wire format

`layouts/` asks the models for a UI layout as a json-render 0.21.0 spec and as A2UI v1.0 messages, with each format's own prompt, and scores the first try. Its README has the details.

## N1 results

[`TARGETS.md`](TARGETS.md) holds the targets and win rules, committed before the first run. `node tasks/vitehub-ui/n1-summary.ts` prints every table and verdict from the stored runs. [n1-results.md](n1-results.md) holds its output from 2026-11-13. The report with the answer first is on Drop (linked from the PR).

## Baseline

N1 ran `ui-dialog-form` on today's stack: each of 6 runs scored 100% ([n1-results.md](n1-results.md)). The other three runnable tasks have no baseline yet. With Opus (Claude Code) and Sol (Codex), three runs each:

```sh
for task in ui-dialog-form ui-settings ui-data-table ui-chat-approval; do
  for agent in opus sol; do pnpm evals run $task --agent $agent --repeat 3 --parallel 3; done
done
```

`pnpm evals tasks` loads every project definition and checks its prompt, starting files, probe ids and target, without running anything.
