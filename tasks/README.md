# Tasks

Each task folder has:

- `PROMPT.md`: what the agent reads. It states a product need and never names the primitive.
- `fixture/`: the starting files. The runner copies them into a fresh Git working copy per run. Tasks that share starting files name the folder with `fixture` in `task.ts` instead.
- `task.ts`: the task id, title and probes. Probes read the files after the run and never see the prompt. A task with `start` also builds and starts the agent's app for gate and runtime probes (see `types.ts`). A rubric project's `judge` config tells the judge how to build and serve its app, which sections each grading session takes, and the stack's grading rules.

`index.ts` lists every project. `rubric.ts` reads a project's `RUBRIC.md`.

`meetups` is the current project (it was `meetups-v2` until 2026-11-10; runs from then keep their ids). The agent starts in an empty folder, so it has no `fixture/` and no probes: the judge grades the app against `RUBRIC.md`, next to the reference app in `reference/`, and a second pass scores its design against `VIBE.md`. `reference-grade.json` is the reference app's blind grade; its Vite Doctor rules are the baseline runs are charged against. The first Meetups project (a starting app and 39 probes) left the repository on 2026-11-10; `git log -- tasks/meetups` has it.

`meal-planner` is the second rubric project: a Vue 3 + Vue Router 5 single-page app with no backend and no Pinia. The agent starts with only `data/` (2,376 recipes and 136 ingredients, written by `data.mjs`, seeded so every run gets the same files). Its rubric has no ViteHub sections, so the headline is 87% rubric and 13% Vite Doctor. The judge serves the build with the preview command the app documents.

`ui-dialog-form`, `ui-settings`, `ui-data-table`, `ui-chat-approval` and `ui-agent-form` measure whether an agent uses ViteHub UI correctly on the first try. They share one Nuxt 5 starter app, a harness and browser probes in `vitehub-ui/`, and each has a `target` score written down before any run. `ui-agent-form` is `pending` until ViteHub Agents can send UI. See [vitehub-ui/README.md](vitehub-ui/README.md).

`pnpm evals tasks` loads every project and checks its prompt, starting files, probe ids and target, without running an agent.

`contact-endpoint` is a dummy task to test the flow end to end. It has no install and no build gate.

The fix and hidden-bug projects (`fix-*`, `scan-meetups`) left on 2026-11-21: without skills, models already scored as high as the reference, so skills had no room to show a difference. `git log -- tasks/scan-meetups` has them.
