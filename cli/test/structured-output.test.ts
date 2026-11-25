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
  // Or closes fails before their why and fix (`"sources":[]},"why"`), which ends the JSON early. Seen on 2026-11-22.
  const fails = { P1: { ...results.P2, evidence: "no 1" }, P2: { ...results.P2, evidence: "no 2" } }
  const earlyBraces = JSON.stringify(fails).replaceAll(`"sources":[],"why"`, `"sources":[]},"why"`)
  assert.deepEqual(recoverStructuredOutput(call({ results: earlyBraces }), schema), { results: fails })
})

test("a grade that misses a check, or a fail without a fix, is not recovered", () => {
  assert.equal(recoverStructuredOutput(call({ results: JSON.stringify({ P1: { outcome: "pass", evidence: "ok", sources: [] } }) }), schema), undefined)
  assert.equal(recoverStructuredOutput(call({ results: JSON.stringify({ P1: { outcome: "pass", evidence: "ok", sources: [] }, P2: { outcome: "fail", evidence: "no", sources: [] } }) }), schema), undefined)
  assert.equal(recoverStructuredOutput("", schema), undefined)
})

test("values the schema rejects are not recovered, and an older valid call is kept instead", () => {
  const text = { type: "string", minLength: 1 }
  const strict = { type: "object", properties: { score: { type: "number", minimum: 0, maximum: 10 }, evidence: text, sources: { type: "array", items: { type: "object", properties: { path: text }, required: ["path"] }, minItems: 1 } }, required: ["score", "evidence", "sources"] }
  const valid = { score: 6, evidence: "ok", sources: [{ path: "a.ts" }] }
  for (const bad of [{ evidence: null }, { evidence: "" }, { score: 11 }, { score: "6" }, { sources: [] }, { sources: [{ path: 3 }] }]) {
    assert.equal(recoverStructuredOutput(call({ ...valid, ...bad }), strict), undefined, JSON.stringify(bad))
    assert.deepEqual(recoverStructuredOutput([call(valid), call({ ...valid, ...bad })].join("\n"), strict), valid)
  }
})
