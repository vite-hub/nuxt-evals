import type { Locator, Page } from "playwright-core"
import type { Task } from "../types.ts"
import { listDeployments } from "../vitehub-ui/fixture/server/utils/store.ts"
import { fixture, startApp, type UiRuntime } from "../vitehub-ui/harness.ts"
import { buildGate, focused, noDivButtons, noHandRolledFocusTrap, noPageErrors, outcome, pageGate, press, type UiProbe } from "../vitehub-ui/probes.ts"

const id = "ui-data-table"
const path = "/deployments"
// The fixture's store is seeded, so the grader knows every row the server sends.
const deployments = listDeployments()
const allIds = deployments.map(item => item.id)
const sortedBy = (key: "durationSeconds" | "createdAt") => deployments.toSorted((a, b) => a[key] < b[key] ? -1 : 1).map(item => item.id)
const matching = (needle: string) => deployments.filter(item => item.branch.toLowerCase().includes(needle) || item.author.toLowerCase().includes(needle)).map(item => item.id)

/** The deployment ids of the data rows, top to bottom, whatever the cells look like. */
async function rowIds(page: Page): Promise<string[]> {
  const texts = await page.getByRole("table").first().getByRole("row").allInnerTexts()
  return texts.map(text => text.match(/dpl_\d{3}/)?.[0]).filter((value): value is string => Boolean(value))
}

async function waitForRows(page: Page, expected: string[], timeoutMs = 4000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs
  let ids = await rowIds(page)
  while (Date.now() < deadline && ids.join() !== expected.join()) {
    await page.waitForTimeout(150)
    ids = await rowIds(page)
  }
  return ids
}

const header = (page: Page, name: RegExp) => page.getByRole("columnheader", { name }).first()
const filterBox = (page: Page) => page.getByRole("searchbox", { name: /filter|search/i }).or(page.getByRole("textbox", { name: /filter|search/i })).first()

/**
 * Activates a column's sort control with the keyboard: a button in the header, or a header that is itself focusable.
 * A sort menu (Ascending / Descending) is a correct form too: then `direction` picks the item.
 */
async function sortColumn(page: Page, name: RegExp, direction: "asc" | "desc"): Promise<void> {
  const cell = header(page, name)
  const button = cell.getByRole("button").first()
  const control: Locator = await button.count() ? button : cell
  await press(control)
  const menu = page.getByRole("menu").first()
  if (await menu.isVisible().catch(() => false)) await press(menu.getByRole("menuitem", { name: direction === "asc" ? /asc/i : /desc/i }).first())
  await page.waitForTimeout(250)
}

/** Sorts a column twice and checks both orders and the header's aria-sort. */
async function checkSort(page: Page, name: RegExp, key: "durationSeconds" | "createdAt", announce: boolean) {
  const ascending = sortedBy(key)
  const descending = ascending.toReversed()
  const seen: string[] = []
  for (const direction of ["asc", "desc"] as const) {
    await sortColumn(page, name, direction)
    const ids = await waitForRows(page, seen.includes("ascending") ? descending : ascending, 1500)
    const order = ids.join() === ascending.join() ? "ascending" : ids.join() === descending.join() ? "descending" : "unsorted"
    if (order === "unsorted") return { passed: false, detail: `After ${seen.length + 1} key press(es) the rows are not sorted by ${name.source}.` }
    if (announce) {
      const aria = await header(page, name).getAttribute("aria-sort")
      if (aria !== order) return { passed: false, detail: `Rows are ${order}, the header says aria-sort=${aria ?? "nothing"}.` }
    }
    seen.push(order)
  }
  const both = new Set(seen).size === 2
  return { passed: both, detail: both ? `Sorted ${seen.join(" then ")}.` : `Both key presses gave ${seen[0]} order.` }
}

const probes: UiProbe[] = [
  buildGate,
  pageGate(path),
  {
    id: "table-semantics",
    title: "A table with Created and Duration column headers and all 48 deployments as rows",
    why: "A grid of divs has no rows or columns for a screen reader: it reads one long run of text.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      if (!await page.getByRole("table").count()) return { passed: false, detail: "No element with role table." }
      for (const name of [/created/i, /duration/i]) {
        if (!await header(page, name).count()) return { passed: false, detail: `No column header named ${name.source}.` }
      }
      const ids = await rowIds(page)
      const all = new Set(ids).size === allIds.length && allIds.every(value => ids.includes(value))
      return { passed: all, detail: `${ids.length} rows` }
    })),
  },
  {
    id: "sort-duration",
    title: "The Duration header's control sorts by duration with Enter, and a second Enter reverses it",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(() => checkSort(page, /duration/i, "durationSeconds", false))),
  },
  {
    id: "sort-created",
    title: "The Created header's control sorts by date with Enter, and a second Enter reverses it",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(() => checkSort(page, /created/i, "createdAt", false))),
  },
  {
    id: "sort-announced",
    title: "The sorted column's header has aria-sort ascending or descending, matching the rows",
    why: "Without aria-sort a screen reader user can't tell which column the table is sorted by, or which way.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(() => checkSort(page, /duration/i, "durationSeconds", true))),
  },
  {
    id: "filter-as-you-type",
    title: "Typing in a search box named Filter deployments filters by branch (fix/cache) and by author (grace) without pressing Enter",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const box = filterBox(page)
      if (!await box.count()) return { passed: false, detail: "No search box or text field named Filter or Search." }
      for (const needle of ["fix/cache", "grace"]) {
        await box.fill("")
        await box.pressSequentially(needle, { delay: 40 })
        const expected = matching(needle)
        const ids = await waitForRows(page, expected)
        if (ids.toSorted().join() !== expected.toSorted().join()) return { passed: false, detail: `"${needle}" shows ${ids.length} rows, ${expected.length} match.` }
      }
      return { passed: true, detail: `${matching("fix/cache").length} and ${matching("grace").length} rows.` }
    })),
  },
  {
    id: "empty-state",
    title: "A filter that matches nothing says so and has a Clear button that brings all rows back",
    why: "An empty table with no words looks broken, and the user has to find and empty the search box by hand.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const box = filterBox(page)
      await box.pressSequentially("zzzz", { delay: 40 })
      await waitForRows(page, [])
      if ((await rowIds(page)).length) return { passed: false, detail: "Rows still show for zzzz." }
      await page.getByText(/no (deployments|results|matches|rows)|nothing (matches|found)|didn.t match/i).first().waitFor({ state: "visible", timeout: 3000 })
      const clear = page.getByRole("button", { name: /clear|reset/i }).first()
      if (!await clear.count()) return { passed: false, detail: "No Clear or Reset button." }
      await press(clear)
      const ids = await waitForRows(page, allIds, 3000)
      const empty = await box.inputValue() === ""
      return { passed: ids.length === allIds.length && empty, detail: `${ids.length} rows after Clear, focus on ${await focused(page)}` }
    })),
  },
  noDivButtons,
  noHandRolledFocusTrap,
  noPageErrors,
]

/**
 * A sortable, filterable table with an empty state. Target 90%: the table part does sorting and aria-sort, but
 * an agent still has to wire the sort control and the empty slot.
 */
const task: Task<UiRuntime> = {
  id,
  title: "ViteHub UI: Deployments table",
  fixture,
  target: 0.9,
  timeLimitMinutes: 30,
  probes,
  start: work => startApp(work, { id, fixture }),
}

export default task
