import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { priceUsage } from "../../../cli/lib/pricing.ts"
import type { RunUsage } from "../../../site/shared/report.ts"
import { callModel, models, type ModelName } from "./models.ts"
import { formats, prompts, score, type Format, type Score } from "./score.ts"
import { findTask, taskSets, type TaskSet } from "./sets.ts"

export interface CallRecord {
  format: Format
  task: string
  model: ModelName
  modelId: string
  effort: string
  repeat: number
  startedAt: string
  wallMs: number
  reply: string
  stop?: string
  error?: string
  parsed: unknown
  valid: boolean
  errors: string[]
  checks: Score["checks"]
  rubricComplete: boolean
  pass: boolean
  usage: RunUsage
}

export interface RunOptions {
  models: ModelName[]
  formats: Format[]
  taskIds: string[]
  repeat: number
  out: string
  concurrency?: number
}

const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length ? (sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2) : 0
}

async function runOne(format: Format, taskId: string, model: ModelName, repeat: number): Promise<CallRecord> {
  const task = findTask(taskId)
  const { system, user } = prompts(format, task)
  const startedAt = new Date().toISOString()
  const start = performance.now()
  const base = { format, task: taskId, model, modelId: models[model].model, effort: models[model].effort, repeat, startedAt }
  try {
    const reply = await callModel(model, system, user)
    const wallMs = Math.round(performance.now() - start)
    const result = score(format, task, reply.text)
    const usage = await priceUsage(models[model].harness, models[model].model, reply.usage)
    return { ...base, wallMs, reply: reply.text, stop: reply.stop, parsed: result.parsed, valid: result.valid, errors: result.errors, checks: result.checks, rubricComplete: result.rubricComplete, pass: result.pass, usage }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ...base, wallMs: Math.round(performance.now() - start), reply: "", error: message, parsed: undefined, valid: false, errors: [message], checks: [], rubricComplete: false, pass: false, usage: {} }
  }
}

function summarize(records: CallRecord[]) {
  const groups = Map.groupBy(records, record => `${record.format}|${record.model}|${record.task}`)
  return [...groups.values()].map((group) => {
    const ok = group.filter(record => !record.error)
    const rate = (pass: (record: CallRecord) => boolean) => ok.length ? ok.filter(pass).length / ok.length : 0
    return {
      format: group[0]!.format,
      model: group[0]!.model,
      task: group[0]!.task,
      calls: group.length,
      callErrors: group.length - ok.length,
      validRate: rate(record => record.valid),
      rubricCompleteRate: rate(record => record.rubricComplete),
      passRate: rate(record => record.pass),
      medianInputTokens: median(ok.map(record => record.usage.inputTokens ?? 0)),
      medianOutputTokens: median(ok.map(record => record.usage.outputTokens ?? 0)),
      medianWallMs: median(ok.map(record => record.wallMs)),
      totalCostUsd: Number(group.reduce((sum, record) => sum + Number(record.usage.costUsd ?? 0), 0).toFixed(6)),
    }
  })
}

/** Runs every format × model × task × repeat call, at most `concurrency` at a time, and writes one JSON per call. */
export async function runLayouts(options: RunOptions): Promise<CallRecord[]> {
  await mkdir(options.out, { recursive: true })
  const jobs = options.formats.flatMap(format => options.taskIds.flatMap(task => options.models.flatMap(model =>
    Array.from({ length: options.repeat }, (_, index) => ({ format, task, model, repeat: index + 1 })))))
  const records: CallRecord[] = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!
      const record = await runOne(job.format, job.task, job.model, job.repeat)
      records.push(record)
      await writeFile(join(options.out, `${job.format}.${job.task}.${job.model}.${job.repeat}.json`), `${JSON.stringify(record, null, 2)}\n`)
      const failed = record.checks.filter(check => !check.pass).map(check => check.id)
      console.log(`${records.length}/${jobs.length} ${job.format} ${job.task} ${job.model} #${job.repeat}: ${record.error ? `error ${record.error.slice(0, 120)}` : `${record.pass ? "pass" : "fail"} (valid ${record.valid}${failed.length ? `, fails ${failed.join(",")}` : ""}) ${record.wallMs} ms`}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 3, 3, jobs.length) }, worker))
  const summary = { createdAt: new Date().toISOString(), options, groups: summarize(records) }
  await writeFile(join(options.out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
  return records
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      model: { type: "string", multiple: true },
      format: { type: "string", multiple: true },
      task: { type: "string", multiple: true },
      set: { type: "string", default: "n1" },
      repeat: { type: "string", default: "3" },
      out: { type: "string" },
    },
  })
  const pick = <T extends string>(given: string[] | undefined, known: readonly T[], label: string): T[] => {
    const chosen = given?.flatMap(value => value.split(",")) ?? [...known]
    for (const value of chosen) if (!known.includes(value as T)) throw new Error(`Unknown ${label} ${value}. Known: ${known.join(", ")}.`)
    return chosen as T[]
  }
  const positive = (value: string) => {
    const number = Number(value)
    if (!Number.isInteger(number) || number < 1) throw new Error(`--repeat must be a positive integer, not ${value}.`)
    return number
  }
  const set = values.set as TaskSet
  if (!(set in taskSets)) throw new Error(`Unknown set ${values.set}. Known: ${Object.keys(taskSets).join(", ")}.`)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const out = values.out ?? join(new URL("../../../cli/.data/layouts/", import.meta.url).pathname, stamp)
  try {
    const records = await runLayouts({
      models: pick(values.model, Object.keys(models) as ModelName[], "model"),
      formats: pick(values.format, formats, "format"),
      taskIds: pick(values.task, taskSets[set].map(task => task.id), "task"),
      repeat: positive(values.repeat),
      out,
    })
    console.log(`${records.filter(record => record.pass).length}/${records.length} first-try passes. Results: ${out}`)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
