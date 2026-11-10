# Tasks

Each task folder has:

- `PROMPT.md`: what the agent reads. It states a product need and never names the primitive.
- `fixture/`: the starting files. The runner copies them into a fresh Git working copy per run.
- `task.ts`: the task id, title and probes. Probes read the files after the run and never see the prompt. A task with `start` also builds and starts the agent's app for gate and runtime probes (see `types.ts`).

`meetups` is the current project (it was `meetups-v2` until 2026-11-10; runs from then keep their ids). The agent starts in an empty folder, so it has no `fixture/` and no probes: the judge grades the app against `RUBRIC.md`, next to the reference app in `reference/`. The first Meetups project (a starting app and 39 probes) left the repository on 2026-11-10; `git log -- tasks/meetups` has it.

`contact-endpoint` is a dummy task to test the flow end to end. It has no install and no build gate.
