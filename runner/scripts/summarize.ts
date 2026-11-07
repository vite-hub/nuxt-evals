// Write (or rewrite) the Comark summary of every saved run through the runner: node --env-file=.env scripts/summarize.ts [id]
import { readdir } from "node:fs/promises"

const runner = process.env.RUNNER_URL ?? "http://127.0.0.1:4811"
const ids = process.argv[2] ? [process.argv[2]] : (await readdir(".data/runs")).sort()

for (const id of ids) {
  const started = Date.now()
  const response = await fetch(`${runner}/api/summarize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  })
  const result = await response.json() as { summary?: string, message?: string }
  console.log(id, response.status, `${Math.round((Date.now() - started) / 1000)}s`, result.summary ? `${result.summary.length} chars` : result.message)
}
