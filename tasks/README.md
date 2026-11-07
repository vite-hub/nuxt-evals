# Tasks

Each task folder has:

- `PROMPT.md`: what the agent reads. It states a product need and never names the primitive.
- `fixture/`: the starting files. The runner copies them into a fresh Git working copy per run.
- `task.ts`: the task id, title and probes. Probes read the files after the run and never see the prompt. A task with `start` also builds and starts the agent's app for gate and runtime probes (see `types.ts`).

`meetups` is the first real project (plan-v2 §5, project 1). Its README lists the features, probes and reference solutions.

`contact-endpoint` is a dummy task to test the flow end to end. It has no install and no build gate.
