// Probes of the checkout stepper tasks (`ui-stepper-kit`, `ui-stepper-tabs`). Both tasks have the same prompt and
// probes on different fixtures. Any correct form passes: a list of steps where the current one has
// aria-current="step", or a tablist whose selected tab controls its panel.
import type { Locator, Page } from "playwright-core"
import { buildGate, focused, noDivButtons, noHandRolledFocusTrap, noPageErrors, outcome, pageGate, press, type UiProbe } from "./probes.ts"

interface Order { address: string, cardName: string }

const path = "/checkout"
const steps = ["Shipping", "Payment", "Review"] as const
type Step = (typeof steps)[number]

/** "Shipping", "1 Shipping", "Step 1: Shipping" or "✓ Shipping", but not "Back to Shipping". */
const stepName = (step: Step) => new RegExp(`^\\W*(?:step\\s*)?\\d*\\W*${step}\\b`, "i")
const addressField = (page: Page) => page.getByRole("textbox", { name: /address/i }).first()
const cardField = (page: Page) => page.getByRole("textbox", { name: /name on card|card ?name|cardholder/i }).first()
const placeOrder = (page: Page) => page.getByRole("button", { name: /place order/i }).first()
const continueButton = (page: Page) => page.getByRole("button", { name: /^\W*(continue|next)\b/i }).first()
const backButton = (page: Page) => page.getByRole("button", { name: /^\W*(back|previous)\b/i }).first()
const content: Record<Step, (page: Page) => Locator> = { Shipping: addressField, Payment: cardField, Review: placeOrder }

interface StepList {
  kind: "tablist" | "aria-current"
  list: Locator
}

/** The tablist that holds a Shipping tab, else the smallest element around the aria-current="step" item that names all three steps. */
async function stepList(page: Page): Promise<StepList> {
  const tablist = page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: stepName("Shipping") }) }).first()
  if (await tablist.count()) return { kind: "tablist", list: tablist }
  const current = page.locator("[aria-current=\"step\"]").first()
  if (await current.count()) return { kind: "aria-current", list: current.locator(`xpath=ancestor::*[${steps.map(step => `contains(., "${step}")`).join(" and ")}][1]`) }
  throw new Error("No step list: no tablist with a Shipping tab, and no element with aria-current=\"step\".")
}

/** The control of a step in the list: its tab, its button or link, or else its text. */
async function stepItem({ kind, list }: StepList, step: Step): Promise<Locator> {
  const name = stepName(step)
  if (kind === "tablist") return list.getByRole("tab", { name }).first()
  const control = list.getByRole("button", { name }).or(list.getByRole("link", { name })).first()
  return await control.count() ? control : list.getByText(name).first()
}

/** The step the page marks as current: the selected tab, or the aria-current="step" item. */
async function currentStep(page: Page): Promise<Step | undefined> {
  const text = await page.evaluate(() => {
    const element = document.querySelector("[role=\"tablist\"] [role=\"tab\"][aria-selected=\"true\"]") ?? document.querySelector("[aria-current=\"step\"]")
    if (!element) return ""
    const labelledBy = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/).map(id => document.getElementById(id)?.textContent ?? "").join(" ")
    return `${element.getAttribute("aria-label") ?? ""} ${labelledBy} ${element.textContent ?? ""}`
  })
  return steps.map(step => ({ step, at: text.search(new RegExp(step, "i")) })).filter(match => match.at >= 0).sort((a, b) => a.at - b.at)[0]?.step
}

const showing = (page: Page, step: Step) => content[step](page).isVisible()

/** Fills the step's field and presses Continue with the keyboard, then waits for the next step's content. */
async function advance(page: Page, field: Locator, value: string, next: Step): Promise<void> {
  await field.fill(value)
  await press(continueButton(page))
  await content[next](page).waitFor({ state: "visible", timeout: 5000 })
}

async function toReview(page: Page, address: string, cardName: string): Promise<void> {
  await advance(page, addressField(page), address, "Payment")
  await advance(page, cardField(page), cardName, "Review")
}

/** Elements of the step list that Tab reaches: enabled, rendered, not inert, with a tabindex of 0 or more. */
async function tabStops(list: StepList): Promise<string[]> {
  const found: string[] = []
  for (const step of steps) {
    const item = await stepItem(list, step)
    if (!await item.count()) continue
    const stops = await item.evaluate((element) => {
      const focusable = "a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=\"true\"]"
      return [element, ...element.querySelectorAll("*")].filter(node => node instanceof HTMLElement && node.matches(focusable)
        && node.tabIndex >= 0 && !(node as HTMLButtonElement).disabled && node.getClientRects().length > 0 && !node.closest("[inert]")).length
    })
    if (stops) found.push(step)
  }
  return found
}

async function insideStepItem(page: Page, list: StepList): Promise<Step | undefined> {
  for (const step of steps) {
    const item = await stepItem(list, step)
    if (await item.count() && await item.evaluate(element => element.contains(document.activeElement))) return step
  }
  return undefined
}

export const probes: UiProbe[] = [
  buildGate,
  pageGate(path),
  {
    id: "step-semantics",
    title: "The page shows the three steps and marks Shipping as current: aria-current=\"step\" on its item, or a selected tab that controls its panel",
    why: "A screen reader user hears which step they are on and how many there are only when the markup says so.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const list = await stepList(page)
      for (const step of steps) if (!await (await stepItem(list, step)).count()) return { passed: false, detail: `The step list has no ${step}.` }
      const current = await currentStep(page)
      if (current !== "Shipping") return { passed: false, detail: `The current step is ${current ?? "not named"}.` }
      if (list.kind === "aria-current") return { passed: true, detail: "aria-current=\"step\" on Shipping." }
      const controls = await list.list.getByRole("tab", { selected: true }).first().getAttribute("aria-controls")
      const panel = page.locator(`[id="${controls ?? ""}"][role="tabpanel"]`)
      const linked = Boolean(controls) && await panel.count() > 0 && await panel.getByRole("textbox", { name: /address/i }).count() > 0
      return { passed: linked, detail: linked ? "The Shipping tab controls the panel with Address." : "The selected tab doesn't control a tabpanel with the Address field." }
    })),
  },
  {
    id: "linear-by-click",
    title: "From an empty Shipping step, clicking Review or Payment in the step list neither shows that step nor makes it current",
    why: "A checkout that lets people skip ahead sends an order without an address or a payment.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const list = await stepList(page)
      for (const step of ["Review", "Payment"] as const) {
        await (await stepItem(list, step)).click({ force: true, timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(400)
        const current = await currentStep(page)
        if (current !== "Shipping") return { passed: false, detail: `Clicking ${step} made ${current ?? "nothing"} current.` }
        if (await showing(page, step)) return { passed: false, detail: `Clicking ${step} showed its content.` }
      }
      return true
    })),
  },
  {
    id: "linear-by-keyboard",
    title: "From an empty Shipping step, ArrowRight, ArrowDown or End in the step list, then Enter or Space, never selects a step not reached",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const list = await stepList(page)
      const sequences = [["ArrowRight", "Enter"], ["ArrowRight", " "], ["ArrowDown", "Enter"], ["End", "Enter"], ["End", " "], ["ArrowRight", "ArrowRight", "Enter"]]
      for (const keys of sequences) {
        const start = await stepItem(list, "Shipping")
        await start.focus().catch(() => {})
        if (!await start.evaluate(element => element.contains(document.activeElement))) return { passed: true, detail: "No step of the list takes focus, so the keyboard can't select one." }
        for (const key of keys) await page.keyboard.press(key)
        await page.waitForTimeout(300)
        const current = await currentStep(page)
        const label = keys.map(key => key === " " ? "Space" : key).join(", ")
        if (current !== "Shipping") return { passed: false, detail: `${label} made ${current ?? "nothing"} current.` }
        for (const step of ["Payment", "Review"] as const) if (await showing(page, step)) return { passed: false, detail: `${label} showed ${step}.` }
      }
      return true
    })),
  },
  {
    id: "continue-moves-focus",
    title: "With Address filled, Continue makes Payment current, and focus goes to its panel, its heading or its step, or a live region names it",
    why: "When focus falls to the page body, a screen reader user doesn't know that the step changed or where they are.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      await advance(page, addressField(page), "12 Harbour Road", "Payment")
      await page.waitForTimeout(400)
      const current = await currentStep(page)
      if (current && current !== "Payment") return { passed: false, detail: `After Continue the current step is ${current}.` }
      const list = await stepList(page).catch(() => undefined)
      const card = cardField(page)
      const panel = card.locator("xpath=ancestor::*[@role=\"tabpanel\" or @role=\"region\" or @role=\"group\" or self::section or self::fieldset or self::form][1]")
      const panelHoldsList = await panel.count() > 0 && await panel.evaluate((element, step) => [...element.querySelectorAll("[aria-current=\"step\"], [role=\"tab\"]")].some(node => node.textContent?.includes(step)), "Shipping")
      const inPanel = await panel.count() > 0 && !panelHoldsList && await panel.evaluate(element => element.contains(document.activeElement))
      const onField = await card.evaluate(element => element === document.activeElement)
      const onHeading = await page.evaluate(() => {
        const active = document.activeElement
        return Boolean(active?.matches("h1, h2, h3, h4, h5, h6, [role=\"heading\"]") && /payment/i.test(active.textContent ?? ""))
      })
      const onStep = list !== undefined && await insideStepItem(page, list) === "Payment"
      const announced = await page.locator("[aria-live]:not([aria-live=\"off\"]), [role=\"status\"], [role=\"alert\"]").filter({ hasText: /payment/i }).count() > 0
      const passed = inPanel || onField || onHeading || onStep || announced
      return { passed, detail: `focus on ${await focused(page)}${announced ? ", a live region names Payment" : ""}` }
    })),
  },
  {
    id: "back-keeps-values",
    title: "From Payment, the step list or a Back button returns to Shipping with the keyboard, and the Address typed there is still there",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const address = "7 Lighthouse Lane"
      await advance(page, addressField(page), address, "Payment")
      await cardField(page).fill("Ada Lovelace")
      let route = "the step list"
      const list = await stepList(page).catch(() => undefined)
      if (list) {
        await press(await stepItem(list, "Shipping")).catch(() => {})
        await page.waitForTimeout(400)
      }
      if (!await addressField(page).isVisible() && await backButton(page).count()) {
        route = "Back"
        await press(backButton(page))
      }
      await addressField(page).waitFor({ state: "visible", timeout: 5000 })
      const current = await currentStep(page)
      if (current && current !== "Shipping") return { passed: false, detail: `After ${route}, the current step is ${current}.` }
      const kept = await addressField(page).inputValue()
      return { passed: kept === address, detail: kept === address ? `Back through ${route}, Address kept.` : `Back through ${route}, Address is "${kept}".` }
    })),
  },
  {
    id: "one-tab-stop",
    title: "The step list is one tab stop: at most one of its steps is in the Tab sequence, on Shipping and on Review, and Tab leaves the list",
    why: "A tab stop per step makes keyboard users walk the whole list, and a tab stop on a step they can't open is a dead end.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const first = await tabStops(await stepList(page))
      if (first.length > 1) return { passed: false, detail: `On Shipping, Tab reaches ${first.join(", ")}.` }
      await toReview(page, "3 Mill Street", "Grace Hopper")
      const list = await stepList(page)
      const last = await tabStops(list)
      if (last.length > 1) return { passed: false, detail: `On Review, Tab reaches ${last.join(", ")}.` }
      if (!last.length) return { passed: true, detail: "No step is in the Tab sequence." }
      for (const key of ["Tab", "Shift+Tab"]) {
        await (await stepItem(list, last[0]!)).focus()
        await page.keyboard.press(key)
        const landed = await insideStepItem(page, list)
        if (landed) return { passed: false, detail: `${key} from ${last[0]} moved to ${landed}.` }
      }
      return { passed: true, detail: `One tab stop, on ${last[0]}.` }
    })),
  },
  {
    id: "place-order",
    title: "Review shows the Address and the Name on card, and Place order saves one order with them (GET /api/orders)",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const order = { address: `${Date.now()} Probe Street`, cardName: "Margaret Hamilton" }
      await toReview(page, order.address, order.cardName)
      for (const value of Object.values(order)) {
        if (!await page.getByText(value).first().isVisible()) return { passed: false, detail: `Review doesn't show "${value}".` }
      }
      await press(placeOrder(page))
      let saved: Order[] = []
      for (let attempt = 0; attempt < 20 && !saved.length; attempt++) {
        await page.waitForTimeout(250)
        saved = (await runtime.json<Order[]>("/api/orders") ?? []).filter(item => item.address === order.address)
      }
      if (saved.length !== 1) return { passed: false, detail: `GET /api/orders has ${saved.length} orders with the typed address.` }
      const passed = saved[0]!.cardName === order.cardName
      return { passed, detail: passed ? "One order with the typed values." : `The order's cardName is "${saved[0]!.cardName}".` }
    })),
  },
  noDivButtons,
  noHandRolledFocusTrap,
  noPageErrors,
]
