// The harness table: the defaults and folders Codex and Claude Code had before it, and the message for one it lacks.
import assert from "node:assert/strict"
import { test } from "node:test"
import { harnessColor, harnessLabel } from "../../site/shared/harnesses.ts"
import { modelSet, resolveSettings } from "../lib/agents.ts"
import { harnessHome } from "../lib/harnesses.ts"
import { agentSkillsDir } from "../lib/setups.ts"

test("each harness keeps its default agent, and an unknown one lists the known ones", () => {
  assert.deepEqual(resolveSettings({}), modelSet.sol)
  assert.deepEqual(resolveSettings({ harness: "claude-code" }), modelSet.opus)
  assert.deepEqual(resolveSettings({ harness: "claude-code", model: "claude-fable-5-2" }), modelSet.fable)
  assert.throws(() => resolveSettings({ harness: "gemini" }), /Unknown harness gemini\. Use codex or claude-code\./)
})

test("sessions and skills stay in the folders each CLI uses", () => {
  assert.deepEqual(harnessHome("codex", "/h"), { config: "/h/.codex", sessions: "/h/.codex/sessions", skills: "/h/.codex/skills" })
  assert.deepEqual(harnessHome("claude-code", "/h"), { config: "/h/.claude", sessions: "/h/.claude/projects", skills: "/h/.claude/skills" })
  assert.equal(agentSkillsDir("claude-code", "/h"), "/h/.claude/skills")
})

test("the site names and colors a harness it can't run yet, and one it has never heard of", () => {
  assert.equal(harnessLabel("claude-code"), "Claude Code")
  assert.equal(harnessLabel("gemini"), "Gemini CLI")
  assert.equal(harnessLabel("qwen-code"), "Qwen Code")
  assert.equal(harnessColor("codex"), "var(--tone-codex, var(--tone-other))")
  assert.equal(harnessColor("qwen-code"), "var(--tone-other, var(--tone-other))")
})
