import type { Locator, Page } from "playwright-core"
import type { Task } from "../types.ts"
import { fixture, startApp, type UiRuntime } from "../vitehub-ui/harness.ts"
import { buildGate, focusInside, focused, noDivButtons, noHandRolledFocusTrap, noPageErrors, outcome, pageGate, pickOption, press, shownValue, type UiProbe } from "../vitehub-ui/probes.ts"

interface Project { slug: string, visibility: string, defaultBranch: string }

const id = "ui-settings"
// Atlas is private on main at start; its members are the first four people of the store. Cosmos is the one probes delete.
const atlas = "/projects/atlas/settings"
const cosmos = "/projects/cosmos/settings"
const atlasMembers = [["Ada Lovelace", "ada@acme.test"], ["Grace Hopper", "grace@acme.test"], ["Linus Torvalds", "linus@acme.test"], ["Margaret Hamilton", "margaret@acme.test"]]

const tab = (page: Page, name: RegExp) => page.getByRole("tab", { name }).first()
const visiblePanel = (page: Page) => page.getByRole("tabpanel").filter({ visible: true }).first()
const publicSwitch = (page: Page) => page.getByRole("switch", { name: /public/i }).first()
const branchSelect = (page: Page) => page.getByRole("combobox", { name: /default branch/i }).first()
const deleteTrigger = (page: Page) => visiblePanel(page).getByRole("button", { name: /delete project/i }).first()

async function selected(control: Locator): Promise<boolean> {
  return await control.getAttribute("aria-selected") === "true"
}

/** Opens a tab the way a mouse user would. The tab probes test the keyboard; the other probes only need the panel. */
async function openTab(page: Page, name: RegExp): Promise<Locator> {
  await tab(page, name).click()
  await page.waitForTimeout(200)
  return visiblePanel(page)
}

/** Opens the delete confirmation on Cosmos with the keyboard and returns it. Accepts a dialog or an alertdialog. */
async function openConfirm(page: Page): Promise<Locator> {
  await openTab(page, /danger/i)
  await press(deleteTrigger(page))
  const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog")).first()
  await confirm.waitFor({ state: "visible", timeout: 5000 })
  await page.waitForTimeout(400)
  return confirm
}

const probes: UiProbe[] = [
  buildGate,
  pageGate(atlas),
  {
    id: "tabs-named",
    title: "The page has a tab list with the tabs General, Members and Danger zone, and General is selected",
    why: "Without tab roles a screen reader announces three buttons and never says which section is open.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(atlas, page => outcome(async () => {
      if (!await page.getByRole("tablist").count()) return { passed: false, detail: "No element with role tablist." }
      for (const name of [/^\s*general/i, /^\s*members/i, /danger zone/i]) {
        if (!await tab(page, name).count()) return { passed: false, detail: `No tab named ${name.source}.` }
      }
      return { passed: await selected(tab(page, /^\s*general/i)), detail: "General is aria-selected." }
    })),
  },
  {
    id: "tabs-arrow-keys",
    title: "Arrow keys move between tabs, and the chosen tab shows its panel (automatic or manual activation)",
    why: "The tab pattern promises arrow keys. Tab-only navigation makes keyboard users walk through every tab.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(atlas, page => outcome(async () => {
      await tab(page, /^\s*general/i).focus()
      for (const name of [/^\s*members/i, /danger zone/i]) {
        await page.keyboard.press("ArrowRight")
        const next = tab(page, name)
        if (!await next.evaluate(element => element === document.activeElement)) return { passed: false, detail: `ArrowRight did not move focus to ${name.source}; focus on ${await focused(page)}.` }
        // Manual activation is fine: Enter selects the focused tab.
        if (!await selected(next)) await page.keyboard.press("Enter")
        if (!await selected(next)) return { passed: false, detail: `${name.source} is not aria-selected after ArrowRight and Enter.` }
      }
      const panel = visiblePanel(page)
      return { passed: await panel.getByRole("button", { name: /delete project/i }).count() > 0, detail: "Danger zone's panel shows Delete project." }
    })),
  },
  {
    id: "members-listed",
    title: "The Members tab shows each member's name, email and role",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(atlas, page => outcome(async () => {
      const panel = await openTab(page, /^\s*members/i)
      const text = await panel.innerText()
      const missing = atlasMembers.flat().filter(value => !text.includes(value))
      if (!/admin/i.test(text) || !/editor/i.test(text) || !/viewer/i.test(text)) missing.push("roles")
      return { passed: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All four members with roles." }
    })),
  },
  {
    id: "switch-keyboard",
    title: "Public project is a switch (role switch, named) that starts off for Atlas and turns on with Space",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(atlas, page => outcome(async () => {
      const toggle = publicSwitch(page)
      if (!await toggle.count()) return { passed: false, detail: "No element with role switch named Public project." }
      if (await toggle.isChecked()) return { passed: false, detail: "The switch is on, but Atlas is private." }
      await press(toggle, " ")
      return { passed: await toggle.isChecked(), detail: "Space turned it on." }
    })),
  },
  {
    id: "select-keyboard",
    title: "Default branch is a named select that shows main for Atlas and picks develop with the keyboard",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(atlas, page => outcome(async () => {
      const select = branchSelect(page)
      if (!await select.count()) return { passed: false, detail: "No select or combobox named Default branch." }
      if (!/main/i.test(await shownValue(select))) return { passed: false, detail: `It shows "${await shownValue(select)}", not main.` }
      await pickOption(page, select, "develop")
      await page.waitForTimeout(200)
      return { passed: /develop/i.test(await shownValue(select)), detail: `It shows "${(await shownValue(select)).trim()}".` }
    })),
  },
  {
    id: "save-persists",
    title: "Save changes stores the switch and the branch, and a reload shows the saved values",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(atlas, page => outcome(async () => {
      await press(publicSwitch(page), " ")
      await pickOption(page, branchSelect(page), "develop")
      await press(page.getByRole("button", { name: /save/i }).first())
      const deadline = Date.now() + 6000
      let saved = await runtime.json<Project>("/api/projects/atlas")
      while (Date.now() < deadline && (saved?.visibility !== "public" || saved.defaultBranch !== "develop")) {
        await page.waitForTimeout(200)
        saved = await runtime.json<Project>("/api/projects/atlas")
      }
      if (saved?.visibility !== "public" || saved.defaultBranch !== "develop") return { passed: false, detail: `The API has ${saved?.visibility} on ${saved?.defaultBranch}.` }
      await page.reload()
      await page.waitForLoadState("load")
      const shown = await publicSwitch(page).isChecked() && /develop/i.test(await shownValue(branchSelect(page)))
      return { passed: shown, detail: shown ? "Saved and shown after a reload." : "Saved, but the page shows old values after a reload." }
    })),
  },
  {
    id: "save-confirmed",
    title: "After Save changes the page says it worked (a toast, a status or a message)",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(atlas, page => outcome(async () => {
      await press(page.getByRole("button", { name: /save/i }).first())
      await page.getByText(/saved|updated|success/i).first().waitFor({ state: "visible", timeout: 5000 })
      return true
    })),
  },
  {
    id: "delete-asks-first",
    title: "Delete project opens a confirmation dialog with focus inside it, and deletes nothing yet",
    why: "One key press must not delete a project.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(cosmos, page => outcome(async () => {
      const confirm = await openConfirm(page)
      const inside = await focusInside(confirm)
      const kept = await runtime.status("/api/projects/cosmos") === 200
      return { passed: inside && kept, detail: !kept ? "The project is gone already." : `focus on ${await focused(page)}` }
    })),
  },
  {
    id: "delete-safe-focus",
    title: "The confirmation does not put focus on the destructive button",
    why: "With focus on Delete, a second Enter deletes the project. The safe default is Cancel or Close.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(cosmos, page => outcome(async () => {
      await openConfirm(page)
      const name = await focused(page)
      return { passed: !/delete|remove|confirm/i.test(name), detail: `focus on ${name}` }
    })),
  },
  {
    id: "delete-cancel-keeps",
    title: "Canceling the confirmation keeps the project and returns focus to Delete project",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(cosmos, page => outcome(async () => {
      const confirm = await openConfirm(page)
      const cancel = confirm.getByRole("button", { name: /cancel|keep/i }).first()
      if (await cancel.count()) await press(cancel)
      else await page.keyboard.press("Escape")
      await confirm.waitFor({ state: "hidden", timeout: 5000 })
      await page.waitForTimeout(300)
      const kept = await runtime.status("/api/projects/cosmos") === 200
      const back = await deleteTrigger(page).evaluate(element => element === document.activeElement).catch(() => false)
      return { passed: kept && back, detail: !kept ? "Cancel deleted the project." : `focus on ${await focused(page)}` }
    })),
  },
  {
    id: "delete-confirms",
    title: "Confirming deletes the project and goes back to the Projects page",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(cosmos, page => outcome(async () => {
      const confirm = await openConfirm(page)
      const button = confirm.getByRole("button", { name: /delete|remove|confirm/i }).last()
      // A confirmation that asks for the project's name first is a correct form too.
      const typed = confirm.getByRole("textbox").first()
      for (const value of ["cosmos", "Cosmos"]) {
        if (!await button.isDisabled() || !await typed.count()) break
        await typed.fill(value)
      }
      await press(button)
      await page.waitForURL(url => url.pathname === "/", { timeout: 8000 })
      const status = await runtime.status("/api/projects/cosmos")
      return { passed: status === 404, detail: `GET /api/projects/cosmos: ${status}` }
    })),
  },
  noDivButtons,
  noHandRolledFocusTrap,
  noPageErrors,
]

/**
 * Project settings with tabs, a switch, a select and a destructive confirmation. Target 90%: every part exists in
 * the stack, but a safe initial focus and arrow-key tabs need the parts' defaults to be right.
 */
const task: Task<UiRuntime> = {
  id,
  title: "ViteHub UI: Project settings",
  fixture,
  target: 0.9,
  timeLimitMinutes: 30,
  probes,
  start: work => startApp(work, { id, fixture }),
}

export default task
