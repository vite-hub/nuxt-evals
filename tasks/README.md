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

## Fix and hidden-bug projects

They start from an app instead of an empty folder. `meetups/base` is the Meetups reference app with its comments removed (`node scripts/strip-reference.mjs` writes it again after the reference changes): the reference's comments name the bug each choice avoids, and would hand the agent the answer.

- `fix-*` projects plant one bug into `meetups/base` (`plant.edits` in `task.ts`: find-and-replace edits that must match once, or whole files) and give the agent a user's report in `PROMPT.md`. `meetups/fix.ts` holds what they share: the judge builds the agent's app, the project's `scripted` checks prove the reported problem is gone (the `Gate:` line of `RUBRIC.md`; a run that fails it scores 0), and one grading session reads the change against the ranked solutions in `RUBRIC.md`. `meetups/FIX-VIBE.md` is the design pass for a change. `meetups/checks.ts` is the HTTP client the scripted checks share. The reference is `meetups/base` itself, so the best fix is the diff from the planted app to it.
- `scan-meetups` plants twelve bugs among decoys (correct code that looks wrong) and asks for `findings.json` without running the app. The judge grades it from the files alone (`judge.static`); its reference is the planted app plus the answer key's `findings.json`.
- `fix-api-token` is the one fix project with its own app, `fix-api-token/base` (Notebook, Nuxt 5 without ViteHub), because Meetups' cookie sessions leave no reason for a bearer header. It comes from [nuxt-agent-pitfalls](https://github.com/Charles5277/nuxt-agent-pitfalls) check 2c: agents reassign `globalThis.$fetch`, which Nuxt never reads.
- `pnpm evals admit <project>` builds the reference and the planted app, starts each, and runs the scripted checks: a fix project is admitted when the reference passes the gate and the planted app fails it.

The cases come from `research/corpus/corpus-v0.md`; each `task.ts` names its corpus id.

