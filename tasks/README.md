# Tasks

Each task folder has:

- `PROMPT.md`: what the agent reads. It states a product need and never names the primitive.
- `fixture/`: the starting files. The runner copies them into a fresh Git working copy per run.
- `task.ts`: the task id, title and probes. Probes read the files after the run and never see the prompt.

`contact-endpoint` is a dummy task to test the flow end to end. It has no install and no build gate. Real tasks are the multi-feature projects in `research/plan-v2.md` §5.
