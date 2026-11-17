// A judge session Claude Code gave up on because the model sent `results` as JSON text: the CLI recovers that grade.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { recoverStructuredOutput } from "../lib/judge.ts"

const answer = {
  anyOf: [
    { type: "object", properties: { outcome: { type: "string", enum: ["pass", "na", "unverified"] }, evidence: { type: "string" }, sources: { type: "array" } }, required: ["outcome", "evidence", "sources"], additionalProperties: false },
    { type: "object", properties: { outcome: { const: "fail" }, evidence: { type: "string" }, sources: { type: "array" }, why: { type: "string" }, fix: { type: "string" } }, required: ["outcome", "evidence", "sources", "why", "fix"], additionalProperties: false },
  ],
}
const schema = { type: "object", properties: { results: { type: "object", properties: { P1: answer, P2: answer }, required: ["P1", "P2"], additionalProperties: false } }, required: ["results"] }
const call = (input: unknown) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "StructuredOutput", input }] } })

test("results sent as JSON text are parsed back when every check is there", () => {
  const results = { P1: { outcome: "pass", evidence: "ok", sources: [] }, P2: { outcome: "fail", evidence: "no", sources: [], why: "w", fix: "f" } }
  const transcript = [call({ results: "{" }), call({ results: JSON.stringify(results) })].join("\n")
  assert.deepEqual(recoverStructuredOutput(transcript, schema), { results })
  // Opus closes a long grade with one brace too many, then gives up with a partial one: the full grade before it wins.
  const extraBrace = [call({ results: `${JSON.stringify(results)}}` }), call({ results: { P2: results.P2 } })].join("\n")
  assert.deepEqual(recoverStructuredOutput(extraBrace, schema), { results })
})

test("a grade that misses a check, or a fail without a fix, is not recovered", () => {
  assert.equal(recoverStructuredOutput(call({ results: JSON.stringify({ P1: { outcome: "pass", evidence: "ok", sources: [] } }) }), schema), undefined)
  assert.equal(recoverStructuredOutput(call({ results: JSON.stringify({ P1: { outcome: "pass", evidence: "ok", sources: [] }, P2: { outcome: "fail", evidence: "no", sources: [] } }) }), schema), undefined)
  assert.equal(recoverStructuredOutput("", schema), undefined)
})
