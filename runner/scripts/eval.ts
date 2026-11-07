// Run a task N times against the local runner: node scripts/eval.ts contact-endpoint 2
const [task = "contact-endpoint", times = "1"] = process.argv.slice(2)
const runner = process.env.RUNNER_URL ?? "http://127.0.0.1:4811"

for (let repeat = 1; repeat <= Number(times); repeat++) {
  const started = Date.now()
  const response = await fetch(`${runner}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task, repeat }),
  })
  const result = await response.json()
  console.log(`#${repeat} ${response.status} ${Math.round((Date.now() - started) / 1000)}s`, JSON.stringify(result))
}
