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
    const browserPath = join(bin, "not-a-directory")
    await writeFile(browserPath, "")

    const failed = await promisify(execFile)(process.execPath, ["evals.ts", "judge", id, "--no-explain"], {
      cwd: cliRoot,
      env: { ...process.env, JUDGE_CLAUDE_CLI: claude, CLIPROXY_URL: "http://127.0.0.1:9", CLIPROXY_API_KEY: "test", PLAYWRIGHT_BROWSERS_PATH: browserPath },
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

test("reference resume reuses grades only for the same inputs and instructions", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "reference-resume-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const claude = join(directory, "claude")
  const interrupt = join(directory, "interrupt")
  const productDone = join(directory, "product-done")
  const browserPath = join(directory, "not-a-directory")
  await writeFile(browserPath, "")
  await writeFile(claude, `#!/usr/bin/env node
const { existsSync, readFileSync, rmSync, writeFileSync, writeSync } = require("node:fs")
const schema = JSON.parse(process.argv[process.argv.indexOf("--json-schema") + 1])
const ids = schema.properties.results?.required ?? []
const prompt = readFileSync(0, "utf8")
const emit = result => writeSync(1, JSON.stringify({ type: "result", ...result }) + "\\n")
const evidence = /Grading revision: (.+)/.exec(prompt)?.[1] ?? readFileSync("input.txt", "utf8")
const results = Object.fromEntries(ids.map(id => [id, { outcome: "pass", evidence, sources: [] }]))
if (!schema.properties.results) {
  emit({ structured_output: { score: 5, summary: "", findings: [] } })
} else if (schema.properties.built) {
  // The setup session: the app "builds" and server.cjs is its production server.
  emit({ structured_output: { built: true, startCommand: "node server.cjs", env: {}, notes: "", results } })
} else if (ids.includes("D10") && existsSync(${JSON.stringify(interrupt)})) {
  // A failure stops the queue, so the data group fails only once the product group has graded.
  const wait = () => existsSync(${JSON.stringify(productDone)}) ? (rmSync(${JSON.stringify(productDone)}), emit({ is_error: true, result: "Interrupted." })) : setTimeout(wait, 50)
  wait()
} else {
  if (ids.includes("P2") && existsSync(${JSON.stringify(interrupt)})) writeFileSync(${JSON.stringify(productDone)}, "")
  emit({ structured_output: { results } })
}
`, { mode: 0o755 })
  // Doctor runs through the shared machine lock; here it runs at once, and its missing CLI leaves a note.
  await writeFile(join(directory, "heavy"), `#!/bin/sh\nshift\nexec "$@"\n`, { mode: 0o755 })
  const environment = {
    JUDGE_CLAUDE_CLI: claude, CLIPROXY_URL: "http://127.0.0.1:9", CLIPROXY_API_KEY: "test",
    PLAYWRIGHT_BROWSERS_PATH: browserPath, VITE_DOCTOR_CLI: join(directory, "no-doctor.mjs"),
    PATH: `${directory}:${process.env.PATH}`,
  }
  for (const [name, value] of Object.entries(environment)) {
    const previous = process.env[name]
    context.after(() => previous === undefined ? delete process.env[name] : process.env[name] = previous)
    process.env[name] = value
  }
  const project = "meetups"
  const task = tasks[project]!
  context.after(() => { tasks[project] = task })
  const server = `require("node:http").createServer((request, response) => response.end("ok")).listen(Number(process.env.PORT), "127.0.0.1")`
  const logs: string[] = []
  const grade = (outDir: string, content: string, resume = false) => judgeApp({
    label: "test-reference", project, outDir, liveReference: true, resume,
    files: [{ path: "input.txt", content }, { path: "server.cjs", content: server }], prompt: "Build a meetups app.", log: line => logs.push(line),
  })

  const unchanged = join(directory, "unchanged")
  const edited = join(directory, "edited")
  const rulesEdited = join(directory, "rules-edited")
  const serverEdited = join(directory, "server-edited")
  await writeFile(interrupt, "")
  for (const outDir of [unchanged, edited, rulesEdited, serverEdited]) {
    await mkdir(outDir)
    const explanation = join(outDir, "explain-product.json")
    await writeFile(explanation, "{}")
    await assert.rejects(grade(outDir, "original"), /Interrupted\./)
    assert.match(await readFile(join(outDir, "product.json"), "utf8"), /original/)
    assert.equal(await readFile(explanation, "utf8"), "{}")
  }
  await rm(interrupt)
  await grade(unchanged, "original", true)
  assert.ok(logs.includes("judge product: reused the saved grade"))
  const expectFreshGrade = async (outDir: string, content: string, evidence: string) => {
    const logStart = logs.length
    const regraded = await grade(outDir, content, true)
    // The setup grader runs on every attempt and never sees the shared-server instructions; the groups are what resume reuses.
    const groupChecks = regraded.checks.filter(check => !task.judge!.setupChecks.includes(check.id))
    assert.ok(groupChecks.length > 0)
    assert.deepEqual([...new Set(groupChecks.map(check => check.evidence))], [evidence])
    assert.ok(!logs.slice(logStart).some(line => line.includes("reused the saved grade")))
  }
  await expectFreshGrade(edited, "updated", "updated")

  const judge = task.judge!
  tasks[project] = { ...tasks[project]!, judge: { ...judge, rules: (app, scratch) => [...judge.rules(app, scratch), "Grading revision: new rules"] } }
  await expectFreshGrade(rulesEdited, "original", "new rules")

  tasks[project] = { ...tasks[project]!, judge: { ...judge, sharedServer: (origin, group, app) => `${judge.sharedServer(origin, group, app)}\nGrading revision: new server instructions` } }
  await expectFreshGrade(serverEdited, "original", "new server instructions")
})
