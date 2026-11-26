The project has ended, but everything that made these numbers is in [the repository](https://github.com/vite-hub/nuxt-evals). You can run any model in Codex or Claude Code on the same projects, and an Opus 5.5 judge grades it with the same rubric. Your results stay on your machine.

## What you need

- Linux or macOS, Node.js 24.15 or newer, and pnpm 11 (`corepack enable` gives you the version the repository asks for).
- An Anthropic API key. The judge is always Opus 5.5, even when you test a GPT model, because a different judge would give scores you can't compare with ours.
- A key for the model you test: Anthropic for Claude Code, or OpenAI or any Responses-compatible endpoint for Codex.
- Money and time. At list prices, a run cost us about $2 to $3 with GPT Sol, $14 with Opus 5.5 and $21 to $30 with Fable 5.2, and each grade about $13 more. A run took 42 minutes at the median and up to two hours, and a grade about 20 minutes more.
- Docker helps: some agents put the app's database in a container, and the judge has to start it.

## 1. Clone and install

```sh
git clone https://github.com/vite-hub/nuxt-evals
cd nuxt-evals
pnpm install
cp cli/.env.example cli/.env
```

## 2. Add your keys

Fill `cli/.env`:

```sh
ANTHROPIC_API_KEY=sk-ant-...   # the judge, the summary, and Claude Code agents
OPENAI_API_KEY=sk-...          # Codex agents
```

`ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` point a harness at any compatible endpoint, such as a router that serves other models. If you sign in with a subscription instead of keys, run a [CLIProxy](https://github.com/router-for-me/CLIProxyAPI) and set `CLIPROXY_URL` and `CLIPROXY_API_KEY`. That's how we ran it, and it wins over the keys when both are set.

## 3. Pick the agent

An agent is a harness, a model and a reasoning effort. Always pass `--harness`, because without it the CLI assumes Codex:

```sh
--harness claude-code --model claude-sonnet-5-5 --reasoning high
--harness codex --model gpt-6.2-sol --reasoning xhigh
```

`--agent opus`, `--agent fable` and `--agent sol` are the settings we used, from `modelSet` in `cli/lib/agents.ts`. Add yours there to give it a short name in run ids.

Only Codex and Claude Code are supported. A run keeps the harness's own session file, and the importer reads only those two formats.

## 4. Pick the project and setup

`pnpm evals tasks` lists the projects. `meetups` is the Nuxt 5 + ViteHub app, and `meal-planner` the Vue app. `--setup` decides what the agent gets besides the prompt:

| Setup | The agent gets |
| --- | --- |
| `A` | Nothing. This is the default. |
| `C` | The Nuxt MCP and the nuxt-skills stack set. |
| `CS` | The same as C, plus "USE ALL THE SKILLS." at the end of the prompt. |
| `V` | The three Vue skills, for Meal planner. |
| `VS` | The same as V, plus the same line. |

The [methodology](/methodology) says why each one exists.

## 5. Run it

```sh
pnpm evals run meetups --harness claude-code --model claude-sonnet-5-5 --reasoning high
```

That runs the agent, grades the app and writes a summary. The agent gets an empty folder in your temp directory and an empty home folder. It stops at the time limit: 60 minutes for Meetups and 120 for Meal planner. To run first and grade later, add `--no-judge`, then run `pnpm evals judge <id>`. `--repeat 3 --parallel 3` runs three at once. Grade one app at a time, though, since each grade already runs three judge sessions that build, serve and drive a browser.

## 6. Read the score

```sh
pnpm evals list
```

That prints one line per run with its score and cost. Everything else is in `cli/.data/runs/<id>/`. `run.json` holds the score and every check with its evidence, and next to it are the agent's session file, the diff and the files it wrote.

To see a run the way this site shows it, start the site locally and push the run to it:

```sh
echo "NUXT_INGEST_TOKEN=pick-any-token" > site/.env
pnpm --filter site exec vitehub database migrate
pnpm dev:site                          # http://127.0.0.1:4791
# in cli/.env: SITE_URL=http://127.0.0.1:4791 and INGEST_TOKEN=pick-any-token
pnpm evals push <id> --no-preview
```

## 7. Compare with ours

Our scores come from the same rubric, judge and prompt, so yours compare with them. Two cautions:

- Three runs of one setup differed by up to 9 points. Run three and compare medians before you call a gap real.
- `evals push` refuses a run whose audit failed, for example an agent that read files outside its folder. Read the session before you push it with `--accept-audit`.

## Known limits

- **Cost for other models.** The price comes from [models.dev](https://models.dev), looked up under OpenAI for Codex and Anthropic for Claude Code. A Gemini or Grok model run through Codex shows no cost.
- **Two harnesses.** Supporting another one means a launch command in `cli/lib/agents.ts`, audit rules in `cli/lib/grade.ts`, a label on the site, and a session reader in ViteHub's `@vite-hub/agent/sessions`.
- **Nothing goes back to this site.** It shows only the runs we made.
