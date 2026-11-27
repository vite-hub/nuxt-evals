Run one Nuxt agent eval from https://github.com/vite-hub/nuxt-evals on this machine and tell me its score. The steps are on https://nuxt-evals.onmax.me/run-it.

1. Check for Linux or macOS, Node.js 24.15+, pnpm 11 (`corepack enable`) and Docker.
2. Clone the repository, run `pnpm install`, and copy `cli/.env.example` to `cli/.env`.
3. Ask me which model to test and how I reach it: an API key, a Claude or ChatGPT subscription, or a gateway such as OpenRouter or Ollama. Fill `cli/.env` as step 2 of the page says. Ask me for each key and never print one.
4. Ask me whether I have Opus 5.5 for the judge. If I don't, add `--no-judge --no-summary` to the run.
5. Pick the harness: `--harness claude-code` for a model with an Anthropic-style API, `--harness codex` for one with an OpenAI-style API.
6. Run `pnpm evals run meetups --harness <harness> --model <model id> --reasoning high`. It takes about 40 minutes and up to 2 hours, plus about 20 for the judge. Don't stop it early.
7. Run `pnpm evals list` and tell me the score, the cost and the run's folder under `cli/.data/runs/`.
