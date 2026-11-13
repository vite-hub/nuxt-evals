import type { Spec } from "@json-render/core"
import * as a2ui from "./a2ui.ts"
import * as jsonRender from "./json-render.ts"
import type { LayoutNode, LayoutTask } from "./tasks.ts"

export const formats = ["json-render", "a2ui"] as const

/**
 * N1's target for each format, over every model, task and repeat: at least 90% of first tries validate, and at least
 * 80% are first-try passes (valid and every rubric check). Written before the first measured call.
 */
export const layoutTarget = { validAtLeast: 0.9, passAtLeast: 0.8 }
export type Format = typeof formats[number]

export interface Score {
  parsed: unknown
  parseError?: string
  valid: boolean
  /** The first validation errors, at most ten. */
  errors: string[]
  checks: { id: string, label: string, pass: boolean }[]
  rubricComplete: boolean
  /** A first-try pass: the reply parses, validates, and passes every rubric check. */
  pass: boolean
  nodes: LayoutNode[]
}

export const prompts = (format: Format, task: LayoutTask) => format === "a2ui"
  ? { system: a2ui.systemPrompt(), user: a2ui.userPrompt(task.prompt) }
  : { system: jsonRender.systemPrompt(), user: jsonRender.userPrompt(task.prompt) }

function read(format: Format, reply: string): { parsed?: unknown, error?: string, result?: { errors: string[], nodes: LayoutNode[] } } {
  if (format === "a2ui") {
    const { messages, error } = a2ui.parseReply(reply)
    return messages ? { parsed: messages, result: a2ui.check(messages) } : { error }
  }
  const { spec, error } = jsonRender.parseReply(reply)
  return spec ? { parsed: spec, result: jsonRender.check(spec) } : { error }
}

export function score(format: Format, task: LayoutTask, reply: string): Score {
  const { parsed, error, result } = read(format, reply)
  const nodes = result?.nodes ?? []
  const errors = error ? [error] : (result?.errors ?? []).slice(0, 10)
  const valid = !error && errors.length === 0
  const checks = task.checks.map(check => ({ id: check.id, label: check.label, pass: check.test(nodes) }))
  const rubricComplete = checks.every(check => check.pass)
  return { parsed, ...(error ? { parseError: error } : {}), valid, errors, checks, rubricComplete, pass: valid && rubricComplete, nodes }
}

/** The reply a model would write for a reference file, in the wire form each format's prompt asks for. */
export const referenceReply = (format: Format, file: string) => format === "a2ui"
  ? a2ui.toReply(file.split("\n").filter(line => line.trim()).map(line => JSON.parse(line) as a2ui.Message))
  : jsonRender.toReply(JSON.parse(file) as Spec)
