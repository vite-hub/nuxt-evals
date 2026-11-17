// The audit's `skillFiles`: which files of the offered skills the agent read, and nothing it only wrote about.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentSession } from "@vite-hub/agent/sessions"
import { skillFilesRead } from "../lib/grade.ts"

const dir = "/tmp/sandbox/home/.codex/skills"
const session = (steps: object[]) => ({ provider: "codex", steps: steps.map((step, index) => ({ type: "tool", id: `${index}`, timestamp: "", ...step })) }) as unknown as AgentSession

test("reads by absolute path, home-relative path, Read and an offered Skill count", () => {
  const files = skillFilesRead(session([
    { name: "command_execution", input: { command: `sed -n 1,200p ${dir}/vue-best-practices/SKILL.md`, cwd: "/tmp/work" } },
    { name: "command_execution", input: { command: "cat ~/.codex/skills/vue-router-best-practices/SKILL.md", cwd: "/tmp/work" } },
    { name: "Read", input: { file_path: `${dir}/vue/references/core-new-apis.md` } },
    { name: "Skill", input: { skill: "vue" } },
  ]), dir, ["vue", "vue-best-practices", "vue-router-best-practices"])
  assert.deepEqual(files, ["vue-best-practices/SKILL.md", "vue-router-best-practices/SKILL.md", "vue/references/core-new-apis.md", "vue/SKILL.md"])
})

test("a relative read from inside a skill folder counts", () => {
  const files = skillFilesRead(session([
    { name: "command_execution", input: { command: "cat SKILL.md references/sfc.md", cwd: `${dir}/vue-best-practices` } },
  ]), dir)
  assert.deepEqual(files, ["vue-best-practices/SKILL.md", "vue-best-practices/references/sfc.md"])
})

test("failed reads, edits, written content and skills outside the setup don't count", () => {
  const files = skillFilesRead(session([
    { name: "Read", input: { file_path: `${dir}/vue/SKILL.md` }, error: "File does not exist." },
    { name: "Write", input: { file_path: "/tmp/work/README.md", content: `See ${dir}/vue/SKILL.md` } },
    { name: "command_execution", kind: "change", input: { command: `apply_patch ${dir}/vue/SKILL.md`, cwd: "/tmp/work" } },
    { name: "Skill", input: { skill: "simplify" } },
  ]), dir, ["vue"])
  assert.deepEqual(files, [])
})
