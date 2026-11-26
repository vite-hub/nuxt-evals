The project ended, but all our code is in [the repository](https://github.com/vite-hub/nuxt-evals). Test any model that Codex or Claude Code can reach, on the same projects and with the same judge. Your results stay on your machine.

## What you need

- Linux or macOS, Node.js 24.15+, and pnpm 11 (`corepack enable`).
- An Anthropic API key. The judge is always Opus 5.5, so your scores compare with ours.
- A key for the model you test.
- Per run: $2 to $3 with GPT Sol, $14 with Opus 5.5, $21 to $30 with Fable 5.2. Grading adds about $13.
- A run takes 42 minutes at the median, up to 2 hours. Grading adds about 20 minutes.
- Docker, for agents that put the database in a container.

## 1. Clone and install

```sh
git clone https://github.com/vite-hub/nuxt-evals
cd nuxt-evals
pnpm install
cp cli/.env.example cli/.env
```

## 2. Add your keys

Edit `cli/.env`:

```sh
ANTHROPIC_API_KEY=sk-ant-...   # the judge, the summary, and Claude Code agents
OPENAI_API_KEY=sk-...          # Codex agents
```

To test another provider's model, set `ANTHROPIC_BASE_URL` to an Anthropic-compatible API, or `OPENAI_BASE_URL` to one that speaks the OpenAI Responses API.

For subscription logins, run [CLIProxy](https://github.com/router-for-me/CLIProxyAPI) and set `CLIPROXY_URL` and `CLIPROXY_API_KEY`. CLIProxy overrides the keys.

## 3. Pick the agent

Always pass `--harness`, because the default is Codex:

```sh
--harness claude-code --model claude-sonnet-5-5 --reasoning high
--harness codex --model gpt-6.2-sol --reasoning xhigh
```

Any model works if its harness can reach it. Only Codex and Claude Code work as harnesses (see Known limits).

`--agent opus`, `--agent fable` and `--agent sol` are the settings we used, from `modelSet` in `cli/lib/agents.ts`.

## 4. Pick the project and setup

`pnpm evals tasks` lists the projects: `meetups` is a Nuxt 5 + ViteHub app, `meal-planner` a Vue app. `--setup` picks what the agent gets besides the prompt. The [methodology](/methodology) says why:

| Setup | Agent gets |
| --- | --- |
| `A` | Nothing. Default. |
| `C` | Nuxt MCP and `nuxt-skills`. |
| `CS` | C plus "USE ALL THE SKILLS." in the prompt. |
| `V` | 3 Vue skills for `meal-planner`. |
| `VS` | V plus the same line. |

## 5. Run it

```sh
pnpm evals run meetups --harness claude-code --model claude-sonnet-5-5 --reasoning high
```

This runs the agent and grades the app. Runs stop at 60 minutes for `meetups` and 120 for `meal-planner`.

Add `--no-judge` to grade later with `pnpm evals judge <id>`. `--repeat 3 --parallel 3` runs three at once. Grade one app at a time, because each grade runs 3 judge sessions that build the app and drive a browser.

## 6. Read the score

```sh
pnpm evals list
```

This prints each run's score and cost. `cli/.data/runs/<id>/` holds `run.json` with every check, the agent's session and the code it wrote.

To view runs on a local site:

```sh
echo "NUXT_INGEST_TOKEN=pick-any-token" > site/.env
pnpm --filter site exec vitehub database migrate
pnpm dev:site                          # http://127.0.0.1:4791
# in cli/.env: SITE_URL=http://127.0.0.1:4791 and INGEST_TOKEN=pick-any-token
pnpm evals push <id> --no-preview
```

## 7. Compare with ours

- Three runs of one setup varied by up to 9 points. Run three and compare medians.
- `evals push` blocks a run if the agent fails the audit, like reading outside its folder. Check the session before using `--accept-audit`.

## Known limits

- **Cost for other models.** Prices come from [models.dev](https://models.dev) under OpenAI for Codex and Anthropic for Claude Code. Gemini or Grok on Codex shows no cost.
- **Two harnesses.** Adding another harness needs changes in `cli/lib/agents.ts`, `cli/lib/grade.ts`, the site, and `@vite-hub/agent/sessions`.
- **Nothing goes back to this site.** It shows only our runs.
