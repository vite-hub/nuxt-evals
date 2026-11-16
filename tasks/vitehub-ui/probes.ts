// Probes and browser helpers every ViteHub UI task shares. Probes grade outcomes: what a keyboard or screen reader
// user gets. They find controls by role and accessible name, so any component library or plain HTML that behaves
// right passes.
import type { Locator, Page } from "playwright-core"
import type { Probe, ProbeOutcome, TaskFile } from "../types.ts"
import type { UiRuntime } from "./harness.ts"

export type UiProbe = Probe<UiRuntime>

/** The app built and its production server answered. */
export const buildGate: UiProbe = {
  id: "build",
  title: "`nuxt build` passes and the production server starts",
  layer: "gate",
  // The grader only runs it when the app started; a failed build fails it with the build's error.
  check: ({ runtime }) => ({ passed: true, detail: `install ${runtime.timings.install} ms, build ${runtime.timings.build} ms, start ${runtime.timings.start} ms` }),
}

export function pageGate(path: string): UiProbe {
  return {
    id: "page-responds",
    title: `${path} answers 200 with server-rendered HTML`,
    layer: "gate",
    check: async ({ runtime }) => {
      const status = await runtime.status(path)
      return { passed: status === 200, detail: `${path}: ${status}` }
    },
  }
}

const template = (file: TaskFile) => file.path.endsWith(".vue") ? (file.content.match(/<template[\s\S]*<\/template>/)?.[0] ?? "") : ""
const appCode = (files: TaskFile[]) => files.filter(file => /\.(vue|ts|tsx|js|mjs)$/.test(file.path) && !file.path.startsWith("server/"))

/**
 * A `div`, `span` or other non-interactive element with a click or key handler is a button that a keyboard and a
 * screen reader can't use. `@click.stop` without a handler only stops propagation and is fine.
 */
export const noDivButtons: UiProbe = {
  id: "no-div-buttons",
  title: "No click handlers on non-interactive elements (div, span, li, tr, td, th, img) and no role=\"button\" on them",
  why: "A div with a click handler can't be reached with Tab or pressed with Enter, and a screen reader doesn't call it a button.",
  layer: "static",
  check: ({ changed }) => {
    const found: string[] = []
    for (const file of appCode(changed)) {
      for (const match of template(file).matchAll(/<(div|span|li|p|img|tr|td|th|section|article|label|i)\b[^>]*?(?:\s(?:@|v-on:)(?:click|keydown|keyup|keypress)(?:\.[\w.]+)?=|\srole=["']button["'])/g)) {
        found.push(`${file.path}: <${match[1]} ...>`)
      }
    }
    return { passed: found.length === 0, ...(found.length ? { detail: found.slice(0, 3).join("; ") } : {}) }
  },
}

/** The dialog, menu and select parts keep focus where it belongs. Code that manages Tab by hand duplicates them, and usually breaks. */
export const noHandRolledFocusTrap: UiProbe = {
  id: "no-hand-rolled-focus-trap",
  title: "No hand-rolled focus trap: no Tab key handling, focusable-element queries or focus-trap packages",
  why: "Hand-written focus traps miss elements, break Shift+Tab and fight the component's own focus handling.",
  layer: "static",
  check: ({ changed }) => {
    const pattern = /\.key\s*[!=]==?\s*["']Tab["']|["']Tab["']\s*[!=]==?\s*[\w.]+\.key|case\s+["']Tab["']|\.keyCode\s*[!=]==?\s*9\b|@keydown\.tab|focus-trap|useFocusTrap|createFocusTrap|\btabbable\b|querySelectorAll(?:<[^>]*>)?\([^)]*(?:tabindex|\[href\]|button\s*,)/
    const found = appCode(changed).filter(file => pattern.test(file.content)).map(file => `${file.path}: ${file.content.match(pattern)?.[0]}`)
    return { passed: found.length === 0, ...(found.length ? { detail: found.slice(0, 3).join("; ") } : {}) }
  },
}

/** Runs last: no uncaught error, console error or Vue warning on any page the probes opened. */
export const noPageErrors: UiProbe = {
  id: "no-page-errors",
  title: "No uncaught errors, console errors or hydration warnings while the probes use the app",
  layer: "runtime",
  check: ({ runtime }) => ({ passed: runtime.errors.length === 0, ...(runtime.errors.length ? { detail: [...new Set(runtime.errors)].slice(0, 3).join(" | ") } : {}) }),
}

/** Turns a thrown Playwright error into a failed outcome with a short reason. */
export async function outcome(run: () => Promise<ProbeOutcome | boolean>): Promise<ProbeOutcome> {
  try {
    const result = await run()
    return typeof result === "boolean" ? { passed: result } : result
  }
  catch (error) {
    return { passed: false, detail: (error instanceof Error ? error.message : String(error)).split("\n")[0]!.slice(0, 300) }
  }
}

/** Activates a control the way a keyboard user does: focus it, then press a key. */
export async function press(control: Locator, key = "Enter"): Promise<void> {
  // A closing popup can hide the rest of the page from the accessibility tree for a moment, so wait for the control.
  await control.waitFor({ state: "visible", timeout: 4000 }).catch(() => { throw new Error(`Not on the page: ${String(control)}`) })
  await control.focus({ timeout: 4000 })
  await control.press(key)
}

/** True when the focused element is inside `container`. */
export async function focusInside(container: Locator): Promise<boolean> {
  return await container.evaluate(element => element.contains(document.activeElement) && document.activeElement !== document.body)
}

/** The accessible name and role of the focused element, from the accessibility tree. */
export async function focused(page: Page): Promise<string> {
  const element = page.locator("*:focus").first()
  if (!await element.count()) return "nothing"
  return await element.ariaSnapshot({ timeout: 2000 }).catch(() => "an element without a role")
}

/**
 * Picks `option` in a select-like control with the keyboard. A native `<select>` takes typeahead. A listbox popup
 * (Reka Select, a combobox) opens with ArrowDown; typing moves to the option, or filters it, and Enter picks it.
 */
export async function pickOption(page: Page, control: Locator, option: string): Promise<void> {
  if (await control.evaluate(element => element.tagName === "SELECT")) {
    await control.selectOption({ label: option }).catch(() => control.selectOption(option.toLowerCase()))
    return
  }
  await control.focus()
  await control.press("ArrowDown")
  await page.getByRole("option", { name: new RegExp(`^\\s*${option}\\s*$`, "i") }).first().waitFor({ state: "visible", timeout: 5000 })
  await page.keyboard.type(option, { delay: 30 })
  await page.keyboard.press("Enter")
}

/** The text a select-like control shows: the selected option of a native select, else its text or value. */
export async function shownValue(control: Locator): Promise<string> {
  return await control.evaluate((element) => {
    if (element instanceof HTMLSelectElement) return element.selectedOptions[0]?.textContent ?? element.value
    if (element instanceof HTMLInputElement) return element.value
    return element.textContent ?? ""
  })
}

export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
