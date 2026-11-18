// `pnpm evals judge` on a run whose grading session crashes: the CLI must fail and store no grade.
import { execFile } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import assert from "node:assert/strict"
import { test } from "node:test"
import { tasks } from "../../tasks/index.ts"
import { judgeApp } from "../lib/judge.ts"
import { cliRoot, runFolder } from "../lib/paths.ts"

test("a grading session that ends with an error writes no grade", async () => {
  const id = `test-judge-failed-${process.pid}`
  const folder = runFolder(id)
  const bin = await mkdtemp(join(tmpdir(), "fake-claude-"))
  try {
    // A Claude Code that reads its prompt, then reports an error that is not a rate limit.
    const claude = join(bin, "claude")
    await writeFile(claude, `#!/usr/bin/env node
const { readFileSync, writeSync } = require("node:fs")
readFileSync(0)
writeSync(1, JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result: "The session crashed." }) + "\\n")
process.exitCode = 1
`)
    await chmod(claude, 0o755)
    await mkdir(folder, { recursive: true })
    const run = { id, suite: "test", project: "meetups", harness: "claude-code", model: "fake", reasoning: "low", setup: "A", repeat: 1, status: "passed", score: 0, startedAt: new Date().toISOString(), durationMs: 0, usage: {}, probes: [], diagnostics: {}, finalText: "Done." }
    await writeFile(join(folder, "run.json"), JSON.stringify(run))
    await writeFile(join(folder, "session.jsonl"), "")
    await writeFile(join(folder, "prompt.md"), "Build a meetups app.")
    await writeFile(join(folder, "files.json"), JSON.stringify([{ path: "package.json", content: "{}" }]))
    // A grade from an earlier attempt, which a later --resume must not mistake for this attempt's.
    await mkdir(join(folder, "judge"), { recursive: true })
    await writeFile(join(folder, "judge", "vibe.json"), JSON.stringify({ score: 9, summary: "old", findings: [] }))
    await writeFile(join(folder, "judge", "explain-product.json"), "{}")

    const failed = await promisify(execFile)(process.execPath, ["evals.ts", "judge", id, "--no-explain"], {
      cwd: cliRoot,
      env: { ...process.env, JUDGE_CLAUDE_CLI: claude, CLIPROXY_URL: "http://127.0.0.1:9", CLIPROXY_API_KEY: "test", PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
    }).then(() => undefined, (error: Error & { stderr?: string }) => error)

    assert.ok(failed, "the judge command should fail")
    assert.match(failed.stderr ?? "", /The session crashed\./)
    const stored = JSON.parse(await readFile(join(folder, "run.json"), "utf8")) as { rubric?: unknown }
    assert.equal(stored.rubric, undefined)
    await assert.rejects(readFile(join(folder, "judge", "vibe.json")), "a fresh attempt drops the last attempt's grades")
    assert.equal(await readFile(join(folder, "judge", "explain-product.json"), "utf8"), "{}")
  }
  finally {
    await rm(folder, { recursive: true, force: true })
    await rm(bin, { recursive: true, force: true })
  }
})

test("reference resume reuses grades only for the same working copy", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "reference-resume-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const claude = join(directory, "claude")
  const interrupt = join(directory, "interrupt")
  await writeFile(claude, `#!/usr/bin/env node
const { existsSync, readFileSync, writeSync } = require("node:fs")
const schema = JSON.parse(process.argv[process.argv.indexOf("--json-schema") + 1])
const ids = schema.properties.results.required
readFileSync(0)
const emit = result => writeSync(1, JSON.stringify({ type: "result", ...result }) + "\\n")
if (ids.includes("D1") && existsSync(${JSON.stringify(interrupt)})) {
  emit({ is_error: true, result: "Interrupted." })
} else {
  const evidence = readFileSync("input.txt", "utf8")
  const results = Object.fromEntries(ids.map(id => [id, { outcome: "pass", evidence, sources: [] }]))
  emit({ structured_output: { results } })
}
`, { mode: 0o755 })
  const environment = { JUDGE_CLAUDE_CLI: claude, CLIPROXY_URL: "http://127.0.0.1:9", CLIPROXY_API_KEY: "test", PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" }
  for (const [name, value] of Object.entries(environment)) {
    const previous = process.env[name]
    context.after(() => previous === undefined ? delete process.env[name] : process.env[name] = previous)
    process.env[name] = value
  }
  const project = "scan-meetups"
  const task = tasks[project]!
  tasks[project] = { ...task, plant: undefined }
  context.after(() => { tasks[project] = task })
  const logs: string[] = []
  const grade = (outDir: string, content: string, resume = false) => judgeApp({
    label: "test-reference", project, outDir, liveReference: true, resume,
    files: [{ path: "input.txt", content }], prompt: "Review the reference app.", log: line => logs.push(line),
  })

  const unchanged = join(directory, "unchanged")
  const edited = join(directory, "edited")
  await writeFile(interrupt, "")
  for (const outDir of [unchanged, edited]) {
    await mkdir(outDir)
    const explanation = join(outDir, "explain-findings.json")
    await writeFile(explanation, "{}")
    await assert.rejects(grade(outDir, "original"), /Interrupted\./)
    assert.match(await readFile(join(outDir, "findings.json"), "utf8"), /original/)
    assert.equal(await readFile(explanation, "utf8"), "{}")
  }
  await rm(interrupt)
  await grade(unchanged, "original", true)
  assert.ok(logs.includes("judge findings: reused the saved grade"))
  logs.length = 0
  const regraded = await grade(edited, "updated", true)
  assert.ok(regraded.checks.length > 0)
  assert.ok(regraded.checks.every(check => check.evidence === "updated"))
  assert.ok(!logs.some(line => line.includes("reused the saved grade")))
})
