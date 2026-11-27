// A driver harness's run: its provider runtime event log reads as an AgentSession, and `pnpm evals hello` passes only
// when the agent wrote hello.txt and finished.
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import type { AgentLaunch } from "../lib/agents.ts"
import { hello, helloPrompt } from "../lib/hello.ts"
import { readRuntimeSession } from "../lib/sessions.ts"

const at = (second: number) => `2026-11-27T10:00:${String(second).padStart(2, "0")}.000Z`
const log = (events: object[]) => events.map(event => JSON.stringify(event)).join("\n")

const meta = { type: "meta", kind: "provider-runtime", threadId: "t1", cwd: "/w", model: "claude-haiku-5-5", startedAt: at(0) }

test("the runtime event log reads as the prompt, the messages, the commands, the edits and the usage", () => {
  const session = readRuntimeSession("opencode", log([
    meta,
    { type: "item.completed", itemId: "u", createdAt: at(1), payload: { itemType: "user_message", status: "completed", data: { text: "Write hello.txt" } } },
    { type: "item.started", itemId: "c", createdAt: at(2), payload: { itemType: "command_execution", status: "inProgress", title: "cat hello.txt", data: { command: "cat hello.txt" } } },
    { type: "item.completed", itemId: "c", createdAt: at(4), payload: { itemType: "command_execution", status: "completed", data: { command: "cat hello.txt", output: "hi\n", exitCode: 0 } } },
    { type: "item.completed", itemId: "e", createdAt: at(5), payload: { itemType: "file_change", status: "completed", title: "hello.txt", data: { fileName: "hello.txt", diff: "+hi" } } },
    { type: "item.completed", itemId: "f", createdAt: at(6), payload: { itemType: "command_execution", status: "completed", data: { command: "false", exitCode: 1, output: "" } } },
    { type: "content.delta", itemId: "m", payload: { streamKind: "assistant_text", delta: "Wrote " } },
    { type: "content.delta", itemId: "m", payload: { streamKind: "assistant_text", delta: "hello.txt." } },
    { type: "item.completed", itemId: "m", createdAt: at(7), payload: { itemType: "assistant_message", status: "completed", data: {} } },
    { type: "turn.completed", createdAt: at(8), payload: { state: "completed", tokenUsage: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 20 } } },
  ]))
  assert.equal(session.provider, "opencode")
  assert.equal(session.status, "completed")
  assert.equal(session.error, undefined)
  assert.equal(session.prompt, "Write hello.txt")
  assert.equal(session.model, "claude-haiku-5-5")
  assert.equal(session.text, "Wrote hello.txt.")
  assert.deepEqual(session.usage, { inputTokens: 100, cachedInputTokens: 40, outputTokens: 20, reasoningTokens: 0, totalTokens: 120 })
  const [command, edit, failed, message] = session.steps
  assert.deepEqual(command, { type: "tool", id: "c", timestamp: at(2), name: "command_execution", title: "cat hello.txt", input: { command: "cat hello.txt" }, output: { output: "hi\n", exitCode: 0 }, completedAt: at(4), durationMs: 2000 })
  assert.equal(edit?.type === "tool" && edit.kind, "change")
  assert.equal(failed?.type === "tool" && failed.error, "completed")
  assert.equal(message?.type === "message" && message.text, "Wrote hello.txt.")
})

test("a turn that failed, or a log that stops before the turn ends, is an error; Pi's usage comes from thread events", () => {
  const failed = readRuntimeSession("gemini", log([meta, { type: "turn.completed", createdAt: at(1), payload: { state: "failed", errorMessage: "quota" } }]))
  assert.equal(failed.status, "failed")
  assert.equal(failed.error, "quota")
  const cut = readRuntimeSession("pi", log([
    meta,
    { type: "thread.token-usage.updated", payload: { usage: { inputTokens: 10, outputTokens: 5 } } },
    { type: "thread.token-usage.updated", payload: { usage: { inputTokens: 7, outputTokens: 1 } } },
  ]))
  assert.equal(cut.error, "The session ended before the turn completed.")
  assert.equal(cut.usage.totalTokens, 23)
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
