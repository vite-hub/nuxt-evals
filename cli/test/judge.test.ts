// `pnpm evals judge` on a run whose grading session crashes: the CLI must fail and store no grade.
import { execFile } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import assert from "node:assert/strict"
import { test } from "node:test"
import { cliRoot, runFolder } from "../lib/paths.ts"

test("a grading session that ends with an error writes no grade", async () => {
  const id = `test-judge-failed-${process.pid}`
  const folder = runFolder(id)
  const bin = await mkdtemp(join(tmpdir(), "fake-claude-"))
  try {
    // A Claude Code that reads its prompt, then reports an error that is not a rate limit.
    const claude = join(bin, "claude")
    await writeFile(claude, `#!/usr/bin/env node
process.stdin.resume()
process.stdin.on("end", () => {
  console.log(JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result: "The session crashed." }))
  process.exit(1)
})
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

    const failed = await promisify(execFile)(process.execPath, ["evals.ts", "judge", id, "--no-explain"], {
      cwd: cliRoot,
      env: { ...process.env, JUDGE_CLAUDE_CLI: claude, CLIPROXY_URL: "http://127.0.0.1:9", CLIPROXY_API_KEY: "test" },
    }).then(() => undefined, (error: Error & { stderr?: string }) => error)

    assert.ok(failed, "the judge command should fail")
    assert.match(failed.stderr ?? "", /The session crashed\./)
    const stored = JSON.parse(await readFile(join(folder, "run.json"), "utf8")) as { rubric?: unknown }
    assert.equal(stored.rubric, undefined)
    await assert.rejects(readFile(join(folder, "judge", "vibe.json")), "a fresh attempt drops the last attempt's grades")
  }
  finally {
    await rm(folder, { recursive: true, force: true })
    await rm(bin, { recursive: true, force: true })
  }
})
