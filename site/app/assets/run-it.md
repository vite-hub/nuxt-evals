The project ended, but all the code is in [the repository](https://github.com/vite-hub/nuxt-evals). Test any model, Chinese ones like Kimi, GLM, Qwen or DeepSeek included, in Claude Code, Codex, Gemini CLI, OpenCode, Pi or Kimi Code, on the same projects and with the same judge. Everything runs and stays on your machine.

<!-- prompt -->

## What you need

- Linux or macOS, Node.js 24.15+, and pnpm 11 (`corepack enable`).
- Access to the model you test, with a key or a subscription.
- Optional: access to Opus 5.5, with an Anthropic API key or a Claude subscription, to run the judge. The judge is always Opus 5.5, so its scores compare with the published ones. Without it, add `--no-judge --no-summary` and the run gets only its test score.
- Per run: $2 to $3 with GPT Sol, $14 with Opus 5.5, $21 to $30 with Fable 5.2. The judge adds about $13.
- A run takes 42 minutes at the median, up to 2 hours. The judge adds about 20 minutes.
- Docker. Some agents run the app's database, such as Postgres, in a container, and the judge starts that container again to build and test the app.

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

For a subscription or another provider, set `EVALS_GATEWAY` to a [ViteHub AI gateway](https://vitehub.dev/docs/gateways) (`cliproxy`, `openrouter`, `vercel`, `litellm` or `ollama`) and add the variables it reads. `cliproxy` works with a Claude or ChatGPT subscription. If the gateway gives Opus 5.5 another id, set `JUDGE_MODEL` to it.

## 3. Pick the agent

Always pass `--harness` or `--agent`, because the default is Codex:

```sh
--harness claude-code --model claude-sonnet-5-5 --reasoning high
--harness codex --model gpt-6.2-sol --reasoning xhigh
--agent gemini --model gemini-3.8-flash
```

Any model works if its harness can reach it. Codex and Claude Code start with the flags of the published runs. The others start through their [ViteHub Agent driver](https://vitehub.dev/docs/agents/agent-drivers), and [Agents through a gateway](https://vitehub.dev/docs/gateways/agents) lists which gateway serves which. Install a harness CLI into `cli/.data/tools` with `npm install -g --prefix cli/.data/tools <package>`, then check it with `pnpm evals hello --agent <harness>`, one short turn that prints PASS or FAIL.

| Harness | `--agent` | Example model | Set in `cli/.env` | Tested live |
| --- | --- | --- | --- | --- |
| Codex | `codex` | `gpt-6.1-sol` | `OPENAI_API_KEY` or `EVALS_GATEWAY` | Yes |
| Claude Code | `claude-code` | `claude-haiku-5-5` | `ANTHROPIC_API_KEY` or `EVALS_GATEWAY` | Yes |
| Gemini CLI | `gemini` | `gemini-3.8-flash` | `GEMINI_API_KEY` or `EVALS_GATEWAY` | Yes |
| OpenCode | `opencode` | `anthropic/claude-haiku-5.5` | `OPENROUTER_API_KEY` or `EVALS_GATEWAY` | Yes |
| Pi | `pi` | `anthropic/claude-haiku-5.5` | `OPENROUTER_API_KEY` or `EVALS_GATEWAY` | Yes |
| Kimi Code | `kimi` | `kimi-k3` | `MOONSHOT_API_KEY` or `EVALS_GATEWAY` | Yes |
| Cursor | `cursor` | Pass `--model` | `CURSOR_API_KEY` | No |
| Grok | `grok` | `grok-4.7` | `XAI_API_KEY` | No |
| Antigravity, Kiro, FX, Muse | `antigravity`, `kiro`, `fx`, `muse` | Pass `--model` | Their own sign-in | No |
| Any ACP agent | `acp --acp-agent <id>` | Pass `--model` | Its own sign-in | No |

"Yes" means a hello turn passed through CLIProxy (`EVALS_GATEWAY=cliproxy`) on 27 November 2026, with `gemini-3.8-flash-high` for Gemini CLI and `claude-haiku-5-5` for the other new ones. Model ids follow the gateway. The judge and the summary go through `EVALS_GATEWAY` too, so set `JUDGE_MODEL` if the gateway names Opus 5.5 differently, or add `--no-judge --no-summary`.

Gemini CLI with a Gemini key. Tested through CLIProxy only:

```sh
npm install -g --prefix cli/.data/tools @google/gemini-cli
# cli/.env: GEMINI_API_KEY=..., no EVALS_GATEWAY
pnpm evals hello --agent gemini
pnpm evals run meal-planner --agent gemini
```

OpenCode with Kimi, through a Moonshot key. Untested:

```sh
npm install -g --prefix cli/.data/tools opencode-ai
# cli/.env: EVALS_GATEWAY=moonshot and MOONSHOT_API_KEY=...
pnpm evals run meetups --agent opencode --model kimi-k3 --no-judge --no-summary
```

Claude Code with GLM, through Z.ai's Anthropic endpoint. Untested:

```sh
# cli/.env: EVALS_GATEWAY=zai and ZAI_API_KEY=...
pnpm evals run meetups --harness claude-code --model glm-5.3 --reasoning high --no-judge --no-summary
```

`--agent opus`, `--agent fable` and `--agent sol` are the settings behind the published results, from `modelSet` in `cli/lib/agents.ts`.

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

## 7. Compare with the published results

- Three runs of one setup varied by up to 9 points. Run three and compare medians.
- `evals push` blocks a run if the agent fails the audit, like reading outside its folder. Check the session before using `--accept-audit`.

## Known limits

- **Cost needs a models.dev id.** Prices come from [models.dev](https://models.dev) for the model id you pass, so `kimi-k3`, `glm-5.3` or `gemini-3.8-flash` show a cost. A name only your gateway knows, such as CLIProxy's `gemini-3.8-flash-high`, shows none.
- **MCP on two harnesses.** Setups C and CS give the agent the Nuxt MCP through Codex's and Claude Code's own flags, so they run on those two only. The other harnesses take A, V and VS, except Gemini CLI, which takes only A for now: ViteHub gives it a home of its own, without the skills. Their audit checks the commands, not which skills the CLI offered.
- **Nothing goes back to this site.** It shows only the published runs.
