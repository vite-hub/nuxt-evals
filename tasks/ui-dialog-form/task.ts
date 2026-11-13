import type { Locator, Page } from "playwright-core"
import type { Task } from "../types.ts"
import { fixture, startApp, type UiRuntime } from "../vitehub-ui/harness.ts"
import { buildGate, focusInside, focused, noDivButtons, noHandRolledFocusTrap, noPageErrors, outcome, pageGate, pickOption, press, type UiProbe } from "../vitehub-ui/probes.ts"

interface Project { slug: string, name: string, visibility: string }

const id = "ui-dialog-form"
const trigger = (page: Page) => page.getByRole("button", { name: /new project/i }).first()
const nameField = (dialog: Locator) => dialog.getByRole("textbox", { name: /^\s*name/i }).first()
const createButton = (dialog: Locator) => dialog.getByRole("button", { name: /create/i }).first()

/** Opens the dialog from its trigger with Enter. */
async function openDialog(page: Page): Promise<Locator> {
  await press(trigger(page))
  const dialog = page.getByRole("dialog", { name: /new project/i })
  await dialog.waitFor({ state: "visible", timeout: 5000 })
  // Dialogs move focus after their open transition.
  await page.waitForTimeout(400)
  return dialog
}

/**
 * The Visibility field in any correct form: a radio group, a select or combobox named Visibility, or a switch or
 * checkbox named Public. Returns how to read it and how to pick Public with the keyboard.
 */
async function visibilityField(page: Page, dialog: Locator): Promise<{ kind: string, isPrivate: () => Promise<boolean>, choosePublic: () => Promise<void> }> {
  const publicRadio = dialog.getByRole("radio", { name: /^\s*public/i }).first()
  if (await publicRadio.count()) {
    const privateRadio = dialog.getByRole("radio", { name: /^\s*private/i }).first()
    return { kind: "radio group", isPrivate: () => privateRadio.isChecked(), choosePublic: () => press(publicRadio, " ") }
  }
  const select = dialog.getByRole("combobox", { name: /visibility/i }).first()
  if (await select.count()) {
    return {
      kind: "select",
      isPrivate: async () => /private/i.test(await select.evaluate(element => element instanceof HTMLSelectElement ? element.selectedOptions[0]?.textContent ?? "" : element.textContent ?? "")),
      choosePublic: () => pickOption(page, select, "Public"),
    }
  }
  const toggle = dialog.getByRole("switch", { name: /public/i }).or(dialog.getByRole("checkbox", { name: /public/i })).first()
  if (await toggle.count()) return { kind: "switch", isPrivate: async () => !await toggle.isChecked(), choosePublic: () => press(toggle, " ") }
  throw new Error("No Visibility field: no radio named Public, no select named Visibility and no switch named Public.")
}

export const probes: UiProbe[] = [
  buildGate,
  pageGate("/"),
  {
    id: "dialog-opens-with-keyboard",
    title: "Enter on the New project button opens a dialog named \"New project\" (role dialog, with an accessible name)",
    why: "Without the dialog role and a name, a screen reader doesn't say that a dialog opened or what it is for.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      await openDialog(page)
      return true
    })),
  },
  {
    id: "dialog-focus-moves-in",
    title: "Opening the dialog moves focus into it",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      const dialog = await openDialog(page)
      return { passed: await focusInside(dialog), detail: `focus on ${await focused(page)}` }
    })),
  },
  {
    id: "dialog-keeps-focus",
    title: "Tab and Shift+Tab stay inside the open dialog",
    why: "If Tab leaves the dialog, keyboard users end up on the page behind it, which they can't see.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      const dialog = await openDialog(page)
      for (const key of [...Array(10).fill("Tab"), ...Array(10).fill("Shift+Tab")] as string[]) {
        await page.keyboard.press(key)
        if (!await focusInside(dialog)) return { passed: false, detail: `${key} moved focus to ${await focused(page)}` }
      }
      return true
    })),
  },
  {
    id: "dialog-escape-returns-focus",
    title: "Escape closes the dialog and focus goes back to the New project button",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      const dialog = await openDialog(page)
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "hidden", timeout: 5000 })
      await page.waitForTimeout(300)
      const back = await trigger(page).evaluate(element => element === document.activeElement)
      return { passed: back, detail: `focus on ${await focused(page)}` }
    })),
  },
  {
    id: "fields-labelled",
    title: "The dialog has a text field named Name and a Visibility field (radio group, select or Public switch) that starts on Private",
    why: "A field without a label is read as \"edit text\", and the user has to guess what to type.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      const dialog = await openDialog(page)
      if (!await nameField(dialog).count()) return { passed: false, detail: "No text field named Name in the dialog." }
      const visibility = await visibilityField(page, dialog)
      return { passed: await visibility.isPrivate(), detail: `Visibility is a ${visibility.kind}` }
    })),
  },
  {
    id: "create-closes-and-lists",
    title: "Creating a public project \"Orion\" with the keyboard closes the dialog, saves it as public and lists it without a reload",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      await page.evaluate(() => { (window as { probeMarker?: boolean }).probeMarker = true })
      const dialog = await openDialog(page)
      await nameField(dialog).fill("Orion")
      await (await visibilityField(page, dialog)).choosePublic()
      await press(createButton(dialog))
      await dialog.waitFor({ state: "hidden", timeout: 8000 })
      const created = (await runtime.json<Project[]>("/api/projects"))?.find(project => project.name === "Orion")
      if (!created) return { passed: false, detail: "GET /api/projects has no Orion." }
      if (created.visibility !== "public") return { passed: false, detail: `Orion was saved as ${created.visibility}.` }
      await page.getByText("Orion", { exact: true }).first().waitFor({ state: "visible", timeout: 5000 })
      const reloaded = !await page.evaluate(() => (window as { probeMarker?: boolean }).probeMarker === true)
      return { passed: !reloaded, detail: reloaded ? "The page reloaded to show it." : "Closed, saved as public, listed." }
    })),
  },
  {
    id: "empty-name-blocked",
    title: "Create with an empty Name sends nothing, keeps the dialog open and marks the field (aria-invalid, an error message, or native required)",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      let posted = false
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/projects") posted = true
      })
      const dialog = await openDialog(page)
      const field = nameField(dialog)
      const button = createButton(dialog)
      const disabled = await button.isDisabled()
      if (!disabled) await press(button)
      else await press(field)
      await page.waitForTimeout(800)
      if (posted) return { passed: false, detail: "The empty name was sent to the API." }
      if (!await dialog.isVisible()) return { passed: false, detail: "The dialog closed." }
      const marked = await field.evaluate((element) => {
        const input = element as HTMLInputElement
        const described = (input.getAttribute("aria-describedby") ?? "").split(/\s+/).some(ref => (document.getElementById(ref)?.textContent ?? "").trim().length > 0)
        return input.getAttribute("aria-invalid") === "true" || described || input.matches(":invalid")
      })
      const alert = await dialog.getByRole("alert").count() > 0
      const required = await field.evaluate(element => element.hasAttribute("required") || element.getAttribute("aria-required") === "true")
      const passed = marked || alert || (disabled && required)
      return { passed, detail: passed ? (disabled ? "Create is disabled and Name is required." : "Field marked.") : "Nothing tells the user what is wrong." }
    })),
  },
  {
    id: "api-error-shown",
    title: "A taken name (\"Atlas\") keeps the dialog open and shows the API's message",
    why: "A dialog that closes or stays silent on a server error loses what the user typed, or leaves them guessing.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage("/", page => outcome(async () => {
      const dialog = await openDialog(page)
      await nameField(dialog).fill("Atlas")
      await press(createButton(dialog))
      await dialog.getByText(/exists|taken|already/i).first().waitFor({ state: "visible", timeout: 6000 })
      return { passed: await dialog.isVisible(), detail: "The API's message shows in the dialog." }
    })),
  },
  noDivButtons,
  noHandRolledFocusTrap,
  noPageErrors,
]

/**
 * A "New project" dialog on the Projects page. The smallest UI task: a dialog, two fields, a submit. Target 100%:
 * when the parts are right, nothing here is hard.
 */
const task: Task<UiRuntime> = {
  id,
  title: "ViteHub UI: New project dialog",
  fixture,
  target: 1,
  timeLimitMinutes: 30,
  probes,
  start: work => startApp(work, { id, fixture }),
}

export default task
