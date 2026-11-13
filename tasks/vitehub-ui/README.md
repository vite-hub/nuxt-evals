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

## Baseline

Not run yet: starting evals needs Maxi's OK. The baseline for the four runnable tasks, with Opus (Claude Code) and Sol (Codex), three runs each:

```sh
for task in ui-dialog-form ui-settings ui-data-table ui-chat-approval; do
  for agent in opus sol; do pnpm evals run $task --agent $agent --repeat 3 --parallel 3; done
done
```

`pnpm evals tasks` loads every project definition and checks its prompt, starting files, probe ids and target, without running anything.
