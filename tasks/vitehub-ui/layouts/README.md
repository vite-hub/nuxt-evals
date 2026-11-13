# Layout wire formats

This eval measures which wire format a model writes correctly on the first try when it writes a UI layout directly as a spec. It compares two formats:

- **json-render**: `@json-render/core` 0.21.0, with the element tree schema of `@json-render/vue/schema` 0.21.0.
- **A2UI v1.0**: server-to-client messages with the A2UI basic catalog.

These are plain model calls, not coding agents. Each call gets the format's own prompt and one product request. There are no tools, no repairs and no retries.

## Prompts

Each format uses its own prompt:

- json-render: `catalog.prompt()` in its default standalone mode (JSONL patches, no fences), and `buildUserPrompt({ prompt })` for the request. The catalog in `json-render.ts` has the 18 components of the A2UI basic catalog, with the same props and enums, in the json-render style: children in the `children` array or in named slots, a `label` prop on Button, and actions in `on.press`. Its one catalog action, `event`, matches the A2UI `event` action: it sends a named event with context to the agent.
- A2UI: the prompt that the A2UI eval gives a model for its `direct_json` format. That is the environment notes from `eval/a2ui_eval/strategies/format.py`, then `DirectJsonFormat([basic catalog]).prompt_generator.generate()` from the A2UI Python SDK. `a2ui/direct_json_prompt.txt` holds that output, and `a2ui/direct_json_prompt.py` writes it again. The request goes to the model as it is.

The files in `a2ui/` come from [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui) at commit `58379ad` (Apache-2.0): `specification/v1_0/json/agent_to_renderer.json`, `specification/v1_0/json/common_types.json`, and `catalogs/basic/v1/catalog.json` as `basic_catalog.json`.

## Tasks

`tasks.ts` holds four requests. Both formats get the same text.

| Task | Request | Rubric checks |
| --- | --- | --- |
| `deploy-approval` | An approval card for a deploy of `acme/web` to production | title first, a Card, the author, 12 files, +340, -87, Approve and Reject buttons with actions, different actions |
| `service-status` | A status table of 4 services | title first, column labels, one row per service that holds its 4 values, each name once |
| `settings-summary` | A settings summary for the workspace Acme | title first, the workspace name, one group per setting that holds its label and value, an Edit settings button with an action |
| `invite-form` | A form to invite a teammate | title first, a bound email field, a bound role choice with 3 options, Member selected, a Send invite button with an action that reads both bindings |

## Scoring

1. **Parse.** json-render: the reply goes through `compileSpecStream`, as the json-render client reads it. Prose and fence lines are skipped, as that client skips them. A line that starts with `{` but is not a JSON patch is a parse error. A2UI: every `<a2ui-json>` block holds one message or an array of messages, as the A2UI SDK parser reads it. Markdown fences inside a block are removed. A reply without a closed block is a parse error.
2. **Validate.**
   - json-render: the catalog's Zod schema (`catalog.validate`), `validateSpec` for the structure, the props of each element against its component's Zod schema after its expressions resolve (as `@json-render/chat` does), and each bound action must be in the catalog or be a built-in action.
   - A2UI: each message against the v1.0 protocol schema with the basic catalog (Ajv, draft 2020-12), then the rules of the spec and of the SDK's strict validation. A surface is created once, with the basic catalog ID, before other messages use it. Component IDs are UAX #31 identifiers and are unique in a list. Each surface has a `root` component, no missing references, no cycles and no components that `root` cannot reach. The A2UI Python SDK's `validate_payload` gives the same result for every A2UI reference.
3. **Rubric.** An adapter per format turns the spec into a flat list of nodes (`{ type, text, props, action?, bind?, children }`). It resolves data bindings (`$state`, `$item`, `$template`, `@path`, `formatString`) and expands repeats and templated lists. The rubric checks of the task run on that list.

A call counts as a **first-try pass** only when the reply parses, validates, and passes every rubric check.

## Run

Install once:

```sh
cd tasks/vitehub-ui/layouts && pnpm install
```

Check the references without a model call. Every `<format>.json[l]` must pass. Every `wrong-invalid` file must fail validation, and every `wrong-rubric` file must validate and fail a rubric check. The script exits with 1 when a reference does not behave as expected.

```sh
node tasks/vitehub-ui/layouts/check.ts
```

Run the matrix from the repository root. `--model`, `--format` and `--task` take one value or a comma list, and each defaults to all.

```sh
node --env-file=cli/.env tasks/vitehub-ui/layouts/run.ts --repeat 3
node --env-file=cli/.env tasks/vitehub-ui/layouts/run.ts --model opus --format a2ui --task invite-form --repeat 1
```

Calls go through CLIProxy (`CLIPROXY_URL`, `CLIPROXY_API_KEY`), 3 at a time at most. Opus (`claude-opus-5-5`) uses the Anthropic Messages API with adaptive thinking at effort medium. Sol (`gpt-6.1-sol`) uses the OpenAI Responses API at effort xhigh. These are the efforts of `modelSet` in `cli/lib/agents.ts`.

## Results

Results go to `cli/.data/layouts/<batch time>/`, or to `--out <dir>`:

- `<format>.<task>.<model>.<repeat>.json`: one file per call, with the raw reply, the parsed spec, the validation result and its first errors, each rubric check, the tokens, the wall time and the cost from models.dev list prices.
- `summary.json`: per format, model and task, the valid rate, the rubric-complete rate, the pass rate, the median tokens and wall time, and the total cost.

## Targets

TBD by parent
