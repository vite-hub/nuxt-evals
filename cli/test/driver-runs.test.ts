// A driver harness's run: its provider runtime event log reads as an AgentSession through ViteHub's reader, and
// `pnpm evals hello` passes only when the agent wrote hello.txt and finished.
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import type { AgentLaunch } from "../lib/agents.ts"
import { hello, helloPrompt } from "../lib/hello.ts"
import { readSession } from "../lib/sessions.ts"

const at = (second: number) => `2026-11-27T10:00:${String(second).padStart(2, "0")}.000Z`
const log = (events: object[]) => events.map(event => JSON.stringify(event)).join("\n")

const meta = { type: "meta", kind: "opencode", threadId: "t1", cwd: "/w", model: "claude-haiku-5-5", startedAt: at(0) }
const turn = "turn-1"

test("the runtime event log reads as the messages, the commands, the edits and the usage", () => {
  const session = readSession("opencode", log([
    meta,
    { type: "turn.started", turnId: turn, createdAt: at(1), payload: {} },
    { type: "item.completed", turnId: turn, itemId: "u", createdAt: at(1), payload: { itemType: "user_message", status: "completed", data: { text: "Write hello.txt" } } },
    { type: "item.started", turnId: turn, itemId: "c", createdAt: at(2), payload: { itemType: "command_execution", status: "inProgress", data: { command: "cat hello.txt" } } },
    { type: "item.completed", turnId: turn, itemId: "c", createdAt: at(4), payload: { itemType: "command_execution", status: "completed", data: { command: "cat hello.txt", output: "hi\n", exitCode: 0 } } },
    { type: "item.completed", turnId: turn, itemId: "e", createdAt: at(5), payload: { itemType: "file_change", status: "completed", data: { fileName: "/w/hello.txt", diff: "@@ -0,0 +1 @@\n+hi\n" } } },
    { type: "item.completed", turnId: turn, itemId: "f", createdAt: at(6), payload: { itemType: "command_execution", status: "completed", data: { command: "false", exitCode: 1, output: "" } } },
    { type: "item.started", turnId: turn, itemId: "m", createdAt: at(7), payload: { itemType: "assistant_message", status: "inProgress", data: {} } },
    { type: "content.delta", turnId: turn, itemId: "m", payload: { streamKind: "assistant_text", delta: "Wrote " } },
    { type: "content.delta", turnId: turn, itemId: "m", payload: { streamKind: "assistant_text", delta: "hello.txt." } },
    { type: "item.completed", turnId: turn, itemId: "m", createdAt: at(8), payload: { itemType: "assistant_message", status: "completed", data: {} } },
    { type: "turn.completed", turnId: turn, createdAt: at(9), payload: { state: "completed", tokenUsage: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 20 } } },
  ]))
  assert.equal(session.provider, "opencode")
  assert.equal(session.status, "completed")
  assert.equal(session.error, undefined)
  assert.equal(session.prompt, "Write hello.txt")
  assert.equal(session.model, "claude-haiku-5-5")
  assert.equal(session.text, "Wrote hello.txt.")
  assert.deepEqual(session.usage, { inputTokens: 100, cachedInputTokens: 40, outputTokens: 20, reasoningTokens: 0, totalTokens: 120 })
  const [command, edit, failed, message] = session.steps
  assert.equal(command?.type === "tool" && (command.input as { command: string }).command, "cat hello.txt")
  assert.equal(edit?.type === "tool" && edit.kind, "change")
  assert.equal(failed?.type === "tool" && failed.error, "Exited with code 1.")
  assert.equal(message?.type === "message" && message.phase, "final")
})

test("a failed turn, a log that stops before the turn ends, or no log at all is an error", () => {
  const failed = readSession("gemini", log([meta, { type: "turn.started", turnId: turn, payload: {} }, { type: "turn.completed", turnId: turn, createdAt: at(1), payload: { state: "failed", errorMessage: "quota" } }]))
  assert.equal(failed.provider, "gemini")
  assert.equal(failed.status, "failed")
  assert.equal(failed.error, "quota")
  const cut = readSession("pi", log([
    meta,
    { type: "turn.started", turnId: turn, payload: {} },
    { type: "thread.token-usage.updated", turnId: turn, payload: { usage: { inputTokens: 10, outputTokens: 5 } } },
  ]))
  assert.equal(cut.status, "failed")
  assert.match(cut.error ?? "", /ended before the turn finished/)
  assert.equal(cut.usage.totalTokens, 15)
  assert.deepEqual({ status: readSession("kimi", "").status, error: readSession("kimi", "").error }, { status: "failed", error: "The harness wrote no event log." })
})

function fakeAgent(write: string | undefined, error?: string) {
  const launches: AgentLaunch[] = []
  const runner = async (launch: AgentLaunch) => {
    launches.push(launch)
    if (write !== undefined) await writeFile(join(launch.work, "hello.txt"), write)
    return error ? { code: 1, error } : { code: 0 }
  }
  return { launches, runner }
}

test("hello passes when the agent writes hi to hello.txt in its own empty workspace", async () => {
  const agent = fakeAgent("hi\n")
  const settings = { harness: "gemini", model: "gemini-3.8-flash-high", reasoning: "default" } as const
  assert.deepEqual(await hello(settings, { runner: agent.runner }), { passed: true })
  const [launch] = agent.launches
  assert.equal(launch?.prompt, helloPrompt)
  assert.equal(launch?.settings, settings)
  assert.notEqual(launch?.work, launch?.home)
  assert.equal(launch?.timeoutMs, 5 * 60_000)
})

test("hello fails with the reason: the agent's error, no file, or the wrong text", async () => {
  const settings = { harness: "pi", model: "claude-haiku-5-5", reasoning: "default" } as const
  assert.deepEqual(await hello(settings, { runner: fakeAgent(undefined, "Gateway refused the key.").runner }), { passed: false, error: "Gateway refused the key." })
  assert.deepEqual(await hello(settings, { runner: fakeAgent(undefined).runner }), { passed: false, error: "The agent wrote no hello.txt." })
  assert.deepEqual(await hello(settings, { runner: fakeAgent("bye").runner }), { passed: false, error: `hello.txt holds "bye", not hi.` })
  assert.deepEqual(await hello(settings, { runner: async () => { throw new Error("Pi isn't installed.") } }), { passed: false, error: "Pi isn't installed." })
})
