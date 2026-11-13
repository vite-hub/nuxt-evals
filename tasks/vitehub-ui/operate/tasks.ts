// Operate tasks: an agent works a running app built with ui-sdk parts, with browser tools or with ui-sdk's agent
// bridge. The agent writes no code. The grader reads the outcome from the app's server, never from the agent's answer.
import type { AppState, Invite, Settings } from "./server.ts"
import { initialSettings } from "./server.ts"

export type OperateDriver = "browser" | "bridge"

/**
 * What counts as a win for the bridge, written before the first run (TARGETS.md). Ratios compare the bridge's median
 * with browser tools' median for the same task and model.
 */
export interface OperateTarget {
  /** The bridge's success rate must be at least browser tools'. */
  successAtLeastBrowser: true
  /** The bridge's median page tool calls, at most this share of browser tools'. */
  toolCallsAtMost: number
  /** The bridge's median page characters, at most this share of browser tools'. */
  charsAtMost: number
}

export interface OperateTask {
  id: string
  title: string
  /** The page the bridge opens and the prompt names. */
  path: string
  /** The task in product words. The same for both drivers. */
  prompt: (origin: string) => string
  check: (state: AppState) => { passed: boolean, detail: string }
  target?: OperateTarget
}

/** One sentence per driver, after the task. It names the tools, as ui-sdk's benchmark gave each agent its tools' instructions. */
export const driverNote: Record<OperateDriver, string> = {
  browser: "Work the page with the `agent-browser` CLI. Its skill is installed. Change the app only through the page.",
  bridge: "The page is open in the browser. Work it with the page's tools: `snapshot`, `query` and `act`. Change the app only through the page.",
}

const expectedSettings: Settings = { ...initialSettings, region: "fra", visibility: "team", emailOnFailure: false }

function differences<T extends object>(actual: T, expected: T): string[] {
  return (Object.keys(expected) as (keyof T)[]).filter(key => actual[key] !== expected[key]).map(key => `${String(key)} is ${JSON.stringify(actual[key])}, expected ${JSON.stringify(expected[key])}`)
}

const changeSetting: OperateTask = {
  id: "ui-operate-settings",
  title: "Operate: change project settings (Switch, Select, RadioGroup)",
  path: "/settings",
  prompt: origin => `Acme Console runs at ${origin}/settings. In the Atlas project's settings, set the default region to Frankfurt, make the project visible to the whole team, and turn off the email I get when a deploy fails. Leave everything else as it is, and save.`,
  check: (state) => {
    if (!state.saves.length) return { passed: false, detail: "Nothing was saved." }
    const wrong = differences(state.settings, expectedSettings)
    return wrong.length ? { passed: false, detail: wrong.join("; ") } : { passed: true, detail: `Saved ${state.saves.length} time(s) with the right values.` }
  },
}

const expectedInvite: Invite = { name: "Jane Moreau", role: "developer", startDate: "2026-12-01", agreed: true, note: "" }

const fillForm: OperateTask = {
  id: "ui-operate-form",
  title: "Operate: fill and send a form (name, Select, Checkbox, date)",
  path: "/invite",
  prompt: origin => `Acme Console runs at ${origin}/invite. Invite Jane Moreau to the team as a Developer. She starts on 1 December 2026, and she has agreed to the security policy. Send the invite.`,
  check: (state) => {
    if (state.invites.length !== 1) return { passed: false, detail: `${state.invites.length} invites were sent, expected 1.` }
    const invite = state.invites[0]!
    const wrong = differences({ ...invite, name: invite.name.trim(), note: invite.note.trim() }, expectedInvite)
    return wrong.length ? { passed: false, detail: wrong.join("; ") } : { passed: true, detail: "One invite with the right values." }
  },
}

export const operateTasks: Record<string, OperateTask> = { [changeSetting.id]: changeSetting, [fillForm.id]: fillForm }
