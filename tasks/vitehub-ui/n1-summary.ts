// Prints N1's results as Markdown tables with the verdicts of TARGETS.md. Reads only stored runs; runs nothing.
//   node tasks/vitehub-ui/n1-summary.ts [--operate <batch>] [--suite n1] [--layouts cli/.data/layouts/n1]
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { type OperateRecord, operateRoot } from "../../cli/lib/operate.ts"
import { runsRoot } from "../../cli/lib/paths.ts"
import type { RunRecord } from "../../site/shared/report.ts"
import type { CallRecord } from "./layouts/run.ts"
import { layoutTarget } from "./layouts/score.ts"
import { operateTarget } from "./operate/tasks.ts"

const { values } = parseArgs({ options: { operate: { type: "string", default: "n1op" }, suite: { type: "string", default: "n1" }, layouts: { type: "string", default: "cli/.data/layouts/n1" } } })

const median = (list: number[]) => {
  const sorted = list.toSorted((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length ? (sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2) : Number.NaN
}
const cost = (list: { usage: { costUsd?: string } }[]) => list.reduce((sum, item) => sum + Number(item.usage.costUsd ?? 0), 0)
const agentOf = (model: string) => model.includes("opus") ? "Opus" : "Sol"
const ratio = (a: number, b: number) => Math.round((a / b) * 100) / 100

async function readJson<T>(path: string): Promise<T | undefined> {
  return await readFile(path, "utf8").then(text => JSON.parse(text) as T, () => undefined)
}

let total = 0

// Operate tasks
const operate = (await Promise.all((await readdir(operateRoot).catch(() => [])).filter(id => id.startsWith(values.operate!)).map(id => readJson<OperateRecord>(join(operateRoot, id, "run.json")))))
  .filter((run): run is OperateRecord => Boolean(run && !run.harnessError))
console.log("## Operate tasks\n")
console.log("| Task | Agent | Driver | Success | Page calls (all) | Page chars (all) | Time s | Tokens | Cost |")
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
const pairs: string[] = []
for (const task of ["ui-operate-settings", "ui-operate-form"]) {
  for (const agent of ["Opus", "Sol"]) {
    const group = (driver: string) => operate.filter(run => run.task === task && agentOf(run.model) === agent && run.driver === driver)
    const stats = (runs: OperateRecord[]) => ({
      passed: runs.filter(run => run.passed).length,
      runs: runs.length,
      calls: median(runs.map(run => run.metrics.pageCalls)),
      allCalls: median(runs.map(run => run.metrics.toolCalls)),
      chars: median(runs.map(run => run.metrics.pageChars)),
      allChars: median(runs.map(run => run.metrics.chars)),
      seconds: Math.round(median(runs.map(run => run.durationMs)) / 1000),
      tokens: median(runs.map(run => (run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0))),
      cost: cost(runs),
    })
    const browser = stats(group("browser"))
    const bridge = stats(group("bridge"))
    for (const [driver, s] of [["browser", browser], ["bridge", bridge]] as const) {
      total += s.cost
      console.log(`| ${task} | ${agent} | ${driver} | ${s.passed}/${s.runs} | ${s.calls} (${s.allCalls}) | ${s.chars} (${s.allChars}) | ${s.seconds} | ${s.tokens} | $${s.cost.toFixed(2)} |`)
    }
    const success = bridge.passed / bridge.runs >= browser.passed / browser.runs
    const calls = ratio(bridge.calls, browser.calls)
    const chars = ratio(bridge.chars, browser.chars)
    const win = success && calls <= operateTarget.toolCallsAtMost && chars <= operateTarget.charsAtMost
    pairs.push(`${task} ${agent}: success ${success ? "ok" : "MISS"}, calls ${calls}x ${calls <= operateTarget.toolCallsAtMost ? "ok" : "MISS"}, chars ${chars}x ${chars <= operateTarget.charsAtMost ? "ok" : "MISS"} (all chars ${ratio(bridge.allChars, browser.allChars)}x) -> ${win ? "WIN" : "no win"}`)
  }
}
console.log(`\n${pairs.map(line => `- ${line}`).join("\n")}`)
const pooled = (driver: string) => operate.filter(run => run.driver === driver)
const browserRuns = pooled("browser")
const bridgeRuns = pooled("bridge")
const bridgeSuccess = bridgeRuns.filter(run => run.passed).length
const browserSuccess = browserRuns.filter(run => run.passed).length
const bridgeCalls = median(bridgeRuns.map(run => run.metrics.pageCalls))
const browserCalls = median(browserRuns.map(run => run.metrics.pageCalls))
const fires = bridgeSuccess < browserSuccess || (bridgeSuccess === browserSuccess && bridgeCalls >= browserCalls)
console.log(`\nStop rule 1: bridge ${bridgeSuccess}/${bridgeRuns.length} against browser ${browserSuccess}/${browserRuns.length}, median page calls ${bridgeCalls} against ${browserCalls}: ${fires ? "FIRES" : "does not fire"}.\n`)

// Coding tasks
const runs = (await Promise.all((await readdir(runsRoot).catch(() => [])).map(id => readJson<RunRecord>(join(runsRoot, id, "run.json")))))
  .filter((run): run is RunRecord => Boolean(run && run.suite === values.suite))
const coding = ["ui-dialog-form", "ui-dialog-form-uisdk", "ui-stepper-kit", "ui-stepper-tabs"]
const targets: Record<string, number> = { "ui-dialog-form": 1, "ui-dialog-form-uisdk": 1, "ui-stepper-kit": 0.9, "ui-stepper-tabs": 0.9 }
console.log("## Coding tasks\n")
console.log("| Task | Agent | Scores | Median | At target | Median tool calls | Median min | Cost |")
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |")
const atTarget: Record<string, { hits: number, scores: number[] }> = {}
for (const task of coding) {
  atTarget[task] = { hits: 0, scores: [] }
  for (const agent of ["Opus", "Sol"]) {
    const group = runs.filter(run => run.project === task && agentOf(run.model) === agent)
    const scores = group.map(run => run.score)
    const hits = scores.filter(score => score >= targets[task]! - 1e-9).length
    atTarget[task]!.hits += hits
    atTarget[task]!.scores.push(...scores)
    total += cost(group)
    console.log(`| ${task} | ${agent} | ${scores.map(score => `${Math.round(score * 100)}%`).join(", ")} | ${Math.round(median(scores) * 100)}% | ${hits}/${group.length} | ${median(group.map(run => run.diagnostics.toolCalls ?? 0))} | ${Math.round(median(group.map(run => run.durationMs)) / 60_000)} | $${cost(group).toFixed(2)} |`)
  }
}
const compare = (a: string, b: string, tie: string) => {
  const left = atTarget[a]!
  const right = atTarget[b]!
  if (left.hits !== right.hits) return left.hits > right.hits ? a : b
  const [ma, mb] = [median(left.scores), median(right.scores)]
  if (ma !== mb) return ma > mb ? a : b
  return tie
}
console.log(`\n- Dialog: ui-sdk ${atTarget["ui-dialog-form-uisdk"]!.hits} at 100% against Nuxt UI ${atTarget["ui-dialog-form"]!.hits} -> ${compare("ui-dialog-form-uisdk", "ui-dialog-form", "tie")}`)
console.log(`- Stepper: kit ${atTarget["ui-stepper-kit"]!.hits} at 90% against Tabs ${atTarget["ui-stepper-tabs"]!.hits} -> ${compare("ui-stepper-kit", "ui-stepper-tabs", "ui-stepper-tabs")}\n`)

// Layouts
const layouts = (await Promise.all((await readdir(values.layouts!).catch(() => [])).filter(name => name.endsWith(".json") && name !== "summary.json").map(name => readJson<CallRecord>(join(values.layouts!, name)))))
  .filter((call): call is CallRecord => Boolean(call))
console.log("## Layout wire format\n")
console.log("| Format | Agent | Valid | First-try pass | Median out tokens | Median s | Cost |")
console.log("| --- | --- | --- | --- | --- | --- | --- |")
const passes: Record<string, number> = {}
for (const format of ["json-render", "a2ui"]) {
  for (const agent of ["Opus", "Sol"]) {
    const group = layouts.filter(call => call.format === format && agentOf(call.modelId) === agent)
    passes[format] = (passes[format] ?? 0) + group.filter(call => call.pass).length
    total += cost(group)
    console.log(`| ${format} | ${agent} | ${group.filter(call => call.valid).length}/${group.length} | ${group.filter(call => call.pass).length}/${group.length} | ${median(group.map(call => call.usage.outputTokens ?? 0))} | ${Math.round(median(group.map(call => call.wallMs)) / 1000)} | $${cost(group).toFixed(2)} |`)
  }
  const all = layouts.filter(call => call.format === format)
  const valid = all.filter(call => call.valid).length / all.length
  const pass = all.filter(call => call.pass).length / all.length
  console.log(`| ${format} | both | ${Math.round(valid * 100)}% ${valid >= layoutTarget.validAtLeast ? "meets" : "misses"} 90% | ${Math.round(pass * 100)}% ${pass >= layoutTarget.passAtLeast ? "meets" : "misses"} 80% | | | |`)
}
console.log(`\n- Wire format: json-render ${passes["json-render"]} against A2UI ${passes.a2ui} -> ${(passes["json-render"] ?? 0) > (passes.a2ui ?? 0) ? "json-render" : "a2ui"}\n`)
console.log(`Total cost of the measured runs: $${total.toFixed(2)}`)
