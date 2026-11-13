import type { Page } from "playwright-core"
import type { Task } from "../types.ts"
import { fixture, startApp, type UiRuntime } from "../vitehub-ui/harness.ts"
import { buildGate, noDivButtons, noHandRolledFocusTrap, noPageErrors, outcome, pageGate, pickOption, press, type UiProbe } from "../vitehub-ui/probes.ts"

interface Bug { id: string, title: string, severity: string, steps: string }

const id = "ui-agent-form"
const path = "/support"
const log = (page: Page) => page.getByRole("log").or(page.locator("[aria-live]:not([aria-live=off])")).first()
const bugForm = (page: Page) => log(page).getByRole("form").or(log(page).locator("form")).first()

async function send(page: Page, text: string): Promise<void> {
  const box = page.getByRole("textbox").last()
  await box.focus({ timeout: 4000 })
  await box.fill(text)
  await box.press("Enter")
  await page.waitForTimeout(300)
  if ((await box.inputValue()).trim()) await press(page.getByRole("button", { name: /send|submit/i }).last())
}

/** Asks for the bug form and waits for it in the conversation. */
async function askForForm(page: Page) {
  await send(page, "I want to report a bug")
  const form = bugForm(page)
  await form.waitFor({ state: "visible", timeout: 15_000 })
  return form
}

const probes: UiProbe[] = [
  buildGate,
  pageGate(path),
  {
    id: "form-in-chat",
    title: "Asking to report a bug shows a form in the conversation with fields named Title, Severity and Steps to reproduce",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const form = await askForForm(page)
      const missing: string[] = []
      if (!await form.getByRole("textbox", { name: /title/i }).count()) missing.push("Title")
      if (!await form.getByRole("combobox", { name: /severity/i }).or(form.getByRole("radiogroup", { name: /severity/i })).count()) missing.push("Severity")
      if (!await form.getByRole("textbox", { name: /steps/i }).count()) missing.push("Steps to reproduce")
      return { passed: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All three fields, labelled." }
    })),
  },
  {
    id: "form-from-agent",
    title: "The page doesn't hard-code the bug form: its fields come from the Agent's answer",
    why: "A form built into the page can't change when the Agent needs other values, which is the point of an Agent that sends UI.",
    layer: "static",
    check: ({ changed }) => {
      const hardCoded = changed.filter(file => file.path.startsWith("app/") && /severity/i.test(file.content)).map(file => file.path)
      return { passed: hardCoded.length === 0, ...(hardCoded.length ? { detail: `Severity in ${hardCoded.join(", ")}` } : {}) }
    },
  },
  {
    id: "form-submits-values",
    title: "Filling and sending the form with the keyboard files a bug with exactly those values, and the Agent answers with its id",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const form = await askForForm(page)
      await form.getByRole("textbox", { name: /title/i }).fill("Export fails")
      const severity = form.getByRole("combobox", { name: /severity/i }).first()
      if (await severity.count()) await pickOption(page, severity, "High")
      else await press(form.getByRole("radio", { name: /high/i }).first(), " ")
      await form.getByRole("textbox", { name: /steps/i }).fill("Open Deployments, press Export")
      await press(form.getByRole("button", { name: /send|submit|report|file/i }).first())
      const bugs = await (async () => {
        for (let attempt = 0; attempt < 30; attempt++) {
          const found = await runtime.json<Bug[]>("/api/bugs")
          if (found?.length) return found
          await page.waitForTimeout(300)
        }
        return []
      })()
      const bug = bugs.find(item => item.title === "Export fails")
      if (!bug) return { passed: false, detail: "No bug filed." }
      if (!/high/i.test(bug.severity) || bug.steps !== "Open Deployments, press Export") return { passed: false, detail: `Filed with ${bug.severity} and "${bug.steps}".` }
      await log(page).getByText(bug.id).first().waitFor({ state: "visible", timeout: 10_000 })
      return { passed: true, detail: `${bug.id} filed and named in the answer.` }
    })),
  },
  {
    id: "form-requires-title",
    title: "Sending the form without a Title files nothing and marks the field",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const before = (await runtime.json<Bug[]>("/api/bugs"))?.length ?? 0
      const form = await askForForm(page)
      const submit = form.getByRole("button", { name: /send|submit|report|file/i }).first()
      if (!await submit.isDisabled()) await press(submit)
      await page.waitForTimeout(1500)
      const after = (await runtime.json<Bug[]>("/api/bugs"))?.length ?? 0
      const title = form.getByRole("textbox", { name: /title/i }).first()
      const marked = await title.evaluate(element => element.getAttribute("aria-invalid") === "true" || (element as HTMLInputElement).matches(":invalid") || element.getAttribute("aria-required") === "true")
      return { passed: after === before && marked, detail: after !== before ? "A bug without a title was filed." : marked ? "Blocked and marked." : "Blocked, but nothing marks the field." }
    })),
  },
  noDivButtons,
  noHandRolledFocusTrap,
  noPageErrors,
]

/**
 * The Agent answers with a form, the user sends it, and the Agent reads the values. Target 85%: it crosses the Agent,
 * the catalog and the chat, which is the most an agent has to get right at once.
 */
const task: Task<UiRuntime> = {
  id,
  title: "ViteHub UI: Agent sends a form",
  fixture,
  target: 0.85,
  timeLimitMinutes: 45,
  pending: "no baseline until W3.3 (`defineAgent({ ui: true })`). That PR pins the fixture to a ViteHub build with it, adds `fileBug()` and `GET /api/bugs` to the store, and teaches the scripted model to answer \"report a bug\" with the form.",
  probes,
  start: work => startApp(work, { id, fixture }),
}

export default task
