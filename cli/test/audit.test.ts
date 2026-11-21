// The audit's outside reads (#15): the shared Playwright browsers are part of the setup, the host's own are not.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentSession } from "@vite-hub/agent/sessions"
import { audit } from "../lib/grade.ts"

const browsersDir = "/home/maxi/.cache/nuxt-evals/ms-playwright"
const session = (commands: string[]) => ({ provider: "codex", steps: commands.map((command, index) => ({ type: "tool", id: `${index}`, timestamp: "", name: "command_execution", input: { command, cwd: "/tmp/work" } })) }) as unknown as AgentSession
const expected = { skills: [], required: [], mcpServers: [], browsersDir }

test("using the shared browsers folder is not a look outside the working copy", () => {
  const result = audit(session([`ls ${browsersDir}`, `${browsersDir}/chromium-1255/chrome-linux/chrome --version`]), "", "", "/tmp/work", expected)
  assert.deepEqual(result.outsideReads, [])
  assert.equal(result.passed, true)
})

test("the host's own Playwright cache is still flagged", () => {
  const result = audit(session(["ls /home/maxi/.cache/ms-playwright"]), "", "", "/tmp/work", expected)
  assert.deepEqual(result.outsideReads, ["ls /home/maxi/.cache/ms-playwright"])
  assert.equal(result.passed, false)
})
