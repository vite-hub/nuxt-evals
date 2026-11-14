/**
 * C4 targets: the wire format for generated layouts, json-render or A2UI.
 *
 * Written on 2026-11-14, before any C4 run. N1 (4 tasks) gave json-render 23 and A2UI 21 first-try passes of 24, and
 * the lead flipped after a rubric fix made once the first replies were seen. C4 asks the same question on more tasks,
 * with a holdout set. This file holds the tasks, the rubric, the win rule and the holdout set. Nothing in it changes
 * after the runs start. If a check proves wrong, the runs stop, the reason is written down, the fix lands in its own
 * commit, and both formats run again from scratch.
 *
 * Setup, as in N1: each format's own prompt (`score.ts`), Opus 5.5 at medium and Sol 6.1 at xhigh (`models.ts`), 3 runs
 * of each format, task and model. Main set: 12 tasks, 72 first tries per format. Holdout set: 4 tasks, 24 first tries
 * per format, run only after the main set and reported apart.
 *
 * A first try passes when the reply parses, validates against the format's schema and catalog, and passes every
 * rubric check of its task. The checks run on the rendered nodes that each format's adapter builds, so both formats
 * meet the same checks.
 *
 * Win rule. On the main set, the format with more first-try passes wins if it leads by at least 3 of 72. Otherwise A2UI
 * stays the default, as C4 says. The holdout set confirms a win when the winner has at least as many holdout passes as
 * the other format. A win that the holdout set does not confirm falls back to A2UI, and the report says so first.
 *
 * Cost rule: if the matrix looks above about $40, each task runs 2 times per model instead of 3, and the report says so.
 */
import type { Format } from "./score.ts"
import { compact, type LayoutNode, type LayoutTask, type RubricCheck } from "./tasks.ts"

export const c4WinRule = { minGap: 3, fallback: "a2ui" } as const satisfies { minGap: number, fallback: Format }

export interface C4Verdict {
  winner: Format
  reason: string
}

/** Applies the win rule to first-try pass counts. */
export function c4Verdict(main: Record<Format, number>, holdout: Record<Format, number>): C4Verdict {
  const [lead, other] = main["json-render"] >= main.a2ui ? (["json-render", "a2ui"] as const) : (["a2ui", "json-render"] as const)
  const gap = main[lead] - main[other]
  if (gap < c4WinRule.minGap) return { winner: c4WinRule.fallback, reason: `main set gap ${gap} is below ${c4WinRule.minGap}, so A2UI stays the default` }
  if (holdout[lead] < holdout[other]) return { winner: c4WinRule.fallback, reason: `${lead} leads the main set by ${gap}, but the holdout set does not confirm it (${holdout[lead]} against ${holdout[other]})` }
  return { winner: lead, reason: `${lead} leads the main set by ${gap} and the holdout set confirms it (${holdout[lead]} against ${holdout[other]})` }
}

const holds = (texts: string[], value: string) => texts.some(text => compact(text).includes(compact(value)))
const allText = (nodes: LayoutNode[]) => nodes.flatMap(node => node.text)
/** A text that is only this label, maybe with a colon: a column or field header. */
const isLabel = (text: string, label: string) => compact(text).replace(/:$/, "") === compact(label)
/** A text that is this label alone, or that starts with it and a colon ("Status: Unpaid"). */
const startsWithLabel = (text: string, label: string) => isLabel(text, label) || compact(text).startsWith(`${compact(label)}:`)

function subtreeIndexes(nodes: LayoutNode[], index: number): number[] {
  const node = nodes[index]
  return node ? [index, ...node.children.flatMap(child => subtreeIndexes(nodes, child))] : []
}
const subtreeText = (nodes: LayoutNode[], index: number) => subtreeIndexes(nodes, index).flatMap(entry => nodes[entry]!.text)

/** The values appear one after the other in reading order. Two values may share a text ("Price: $0 | $20"). */
function inOrder(texts: string[], values: string[]): boolean {
  const joined = texts.map(compact).join("\u0000")
  let at = 0
  for (const value of values.map(compact)) {
    const found = joined.indexOf(value, at)
    if (found < 0) return false
    at = found + value.length
  }
  return true
}

interface Group {
  required: string[]
  /** Texts that must not be in the group: the keys of the other rows. */
  forbidden?: string[]
  /** Forbidden texts match only as a label: a text that is the label, or starts with it and a colon. */
  forbiddenAsLabel?: boolean
  ordered?: boolean
  /** More conditions on the group's node. */
  where?: (nodes: LayoutNode[], index: number) => boolean
  /** Look only under this node. */
  within?: number
}

/** Some component groups every required value and no forbidden one, like one table row or one list item. */
function grouped(nodes: LayoutNode[], group: Group): boolean {
  const scope = group.within === undefined ? nodes.map((_, index) => index) : subtreeIndexes(nodes, group.within)
  return scope.some((index) => {
    const texts = subtreeText(nodes, index)
    const forbidden = (group.forbidden ?? []).some(value => group.forbiddenAsLabel ? texts.some(text => startsWithLabel(text, value)) : holds(texts, value))
    if (forbidden || !group.required.every(value => holds(texts, value))) return false
    if (group.ordered && !inOrder(texts, group.required)) return false
    return group.where ? group.where(nodes, index) : true
  })
}

const has = (value: string) => (nodes: LayoutNode[]) => holds(allText(nodes), value)

/** One of the first two visible strings holds the title. A short label above it, like "Approval required", is fine. */
const titleFirst = (title: string): RubricCheck => ({
  id: "title",
  label: `The title "${title}" is one of the first two texts`,
  test: nodes => allText(nodes).filter(text => text.trim()).slice(0, 2).some(text => compact(text).includes(compact(title))),
})

const text = (id: string, value: string): RubricCheck => ({ id, label: `A text holds "${value}"`, test: has(value) })

/** Buttons under a node (or anywhere) whose label matches. */
function buttons(nodes: LayoutNode[], label: RegExp, under?: number): LayoutNode[] {
  const scope = under === undefined ? nodes.map((_, index) => index) : subtreeIndexes(nodes, under)
  return scope.filter(index => nodes[index]!.type === "Button" && subtreeText(nodes, index).some(entry => label.test(entry))).map(index => nodes[index]!)
}

/** The action sends an event to the agent: A2UI's `event` action, or the json-render catalog's `event` action. */
const toAgent = (node: LayoutNode) => /"action":"event"|^\[?\{"event":/.test(node.action ?? "")
/** The resolved action holds one of these values: an id, a name, a URL. */
const says = (node: LayoutNode, values: string[]) => values.some(value => compact(node.actionValue ?? "").includes(compact(value)))

const agentButton = (id: string, name: string, label: RegExp): RubricCheck => ({
  id,
  label: `A ${name} button that sends an event to the agent`,
  test: nodes => buttons(nodes, label).some(toAgent),
})

const linkButton = (id: string, name: string, label: RegExp, url: string): RubricCheck => ({
  id,
  label: `A ${name} button whose action holds ${url}`,
  test: nodes => buttons(nodes, label).some(node => says(node, [url])),
})

const distinct = (id: string, first: RegExp, second: RegExp): RubricCheck => ({
  id,
  label: "The two buttons send different actions",
  test: (nodes) => {
    const a = buttons(nodes, first).find(toAgent)?.actionValue
    const b = buttons(nodes, second).find(toAgent)?.actionValue
    return Boolean(a && b && a !== b)
  },
})

/** Label and value pairs: one check per pair, grouped apart from the other labels. */
const pairs = (rows: [string, string][]): RubricCheck[] => rows.map(([label, value]) => ({
  id: `pair-${compact(label).replace(/[^a-z0-9]/g, "")}`,
  label: `One component groups ${label} and ${value} and no other label`,
  test: nodes => grouped(nodes, { required: [label, value], forbidden: rows.map(row => row[0]).filter(other => other !== label), forbiddenAsLabel: true }),
}))

/**
 * A table given as header and rows, where the first cell is the row's key. It passes row by row (a component per row
 * with its cells in order) or column by column (a component per column with its header and cells in order), so a
 * table of rows, a grid of columns and one card per column all count.
 */
function tableChecks(headers: string[], rows: string[][]): RubricCheck[] {
  const keys = rows.map(row => row[0]!)
  const byColumn = (nodes: LayoutNode[]) => headers.slice(1).every((header, column) => grouped(nodes, {
    required: [header, ...rows.map(row => row[column + 1]!)],
    forbidden: headers.slice(1).filter(other => other !== header),
    forbiddenAsLabel: true,
    ordered: true,
  }))
  return [
    {
      id: "headers",
      label: `Texts hold the headers ${headers.join(", ")}`,
      test: nodes => headers.every(header => allText(nodes).some(entry => startsWithLabel(entry, header))),
    },
    ...rows.map((row): RubricCheck => ({
      id: `row-${compact(row[0]!).replace(/[^a-z0-9]/g, "")}`,
      label: `${row.join(", ")}: one component holds the row in order and no other row, or each column holds its cells in order`,
      test: nodes => grouped(nodes, { required: row, forbidden: keys.filter(key => key !== row[0]), ordered: true }) || byColumn(nodes),
    })),
  ]
}

/** One check per list item: its texts are grouped apart from the other items, with buttons that name the item. */
function itemChecks(items: { key: string, texts: string[], ids: string[] }[], actions: { name: string, label: RegExp }[]): RubricCheck[] {
  const keys = items.map(item => item.key)
  return items.flatMap(item => [
    {
      id: `item-${compact(item.key).replace(/[^a-z0-9]/g, "")}`,
      label: `One component groups ${item.texts.join(", ")} and no other item`,
      test: (nodes: LayoutNode[]) => grouped(nodes, { required: item.texts, forbidden: keys.filter(key => key !== item.key) }),
    },
    {
      id: `actions-${compact(item.key).replace(/[^a-z0-9]/g, "")}`,
      label: `That item has ${actions.map(action => action.name).join(" and ")} buttons whose events name ${item.ids.join(" or ")}`,
      test: (nodes: LayoutNode[]) => grouped(nodes, {
        required: [item.key],
        forbidden: keys.filter(key => key !== item.key),
        where: (all, index) => actions.every(action => buttons(all, action.label, index).some(node => toAgent(node) && says(node, item.ids))),
      }),
    },
  ])
}

/**
 * A chart as data: one component per point with its label and value, the values read from the state or data model,
 * the labels in order.
 */
function chartChecks(points: [string, string][]): RubricCheck[] {
  const labels = points.map(point => point[0])
  return [
    ...points.map(([label, value]): RubricCheck => ({
      id: `point-${compact(label).replace(/[^a-z0-9]/g, "")}`,
      label: `One component groups ${label} and ${value} and no other point`,
      test: nodes => grouped(nodes, { required: [label, value], forbidden: labels.filter(other => other !== label) }),
    })),
    { id: "order", label: `The points appear in the order ${labels.join(", ")}`, test: nodes => inOrder(allText(nodes), labels) },
    {
      id: "bound-values",
      label: "Each value is shown by a text bound to the state or data model",
      test: nodes => points.every(([, value]) => nodes.some(node => node.bound?.some(prop => ["text", "label"].includes(prop)) && holds(node.text, value))),
    },
  ]
}

const steps = [
  ["Create the R2 bucket", "done"],
  ["Copy 18,402 files", "running"],
  ["Switch reads to R2", "waiting"],
  ["Delete the old bucket", "needs approval"],
] as const

const tabTitles = ["Overview", "Deployments", "Settings"]
const tabsNode = (nodes: LayoutNode[]) => nodes.find(node => node.type === "Tabs" && inOrder(node.text, tabTitles))
const tabChild = (nodes: LayoutNode[], tab: number) => tabsNode(nodes)?.children[tab]

export const c4Tasks: LayoutTask[] = [
  {
    id: "migration-approval",
    prompt: [
      "Show an approval card for a database migration.",
      "Title: \"Run migration 0042_add_invoices on production\".",
      "Show who asked, Priya Shah, the tables it changes, invoices and invoice_lines, and the expected lock time, 4 s.",
      "Add an Approve button and a Deny button. Each button must tell the agent which choice the user made.",
    ].join("\n"),
    checks: [
      titleFirst("Run migration 0042_add_invoices on production"),
      { id: "card", label: "A Card holds the title", test: nodes => nodes.some((node, index) => node.type === "Card" && holds(subtreeText(nodes, index), "0042_add_invoices")) },
      text("requester", "Priya Shah"),
      { id: "tables", label: "Texts hold invoices and invoice_lines", test: nodes => has("invoice_lines")(nodes) && allText(nodes).some(entry => /\binvoices\b/i.test(entry)) },
      text("lock-time", "4 s"),
      agentButton("approve", "Approve", /approve/i),
      agentButton("deny", "Deny", /deny/i),
      distinct("distinct-actions", /approve/i, /deny/i),
    ],
  },
  {
    id: "job-queue",
    prompt: [
      "Show a status table of 5 background jobs with the columns Job, Queue, State and Attempts.",
      "Title: \"Background jobs\".",
      "- send-welcome-email, emails, done, 1",
      "- resize-avatar, images, running, 2",
      "- sync-stripe, billing, failed, 5",
      "- nightly-report, reports, queued, 0",
      "- purge-sessions, maintenance, done, 1",
    ].join("\n"),
    checks: [
      titleFirst("Background jobs"),
      ...tableChecks(["Job", "Queue", "State", "Attempts"], [
        ["send-welcome-email", "emails", "done", "1"],
        ["resize-avatar", "images", "running", "2"],
        ["sync-stripe", "billing", "failed", "5"],
        ["nightly-report", "reports", "queued", "0"],
        ["purge-sessions", "maintenance", "done", "1"],
      ]),
    ],
  },
  {
    id: "invoice-summary",
    prompt: [
      "Show a summary of an invoice as a list of labels and values. Show each value exactly as written.",
      "Title: \"Invoice INV-2041\".",
      "- Customer: Northwind Traders",
      "- Issued: 2 Nov 2026",
      "- Due: 2 Dec 2026",
      "- Amount: €4,250.00",
      "- Status: Unpaid",
      "Add a Send reminder button. It must tell the agent which invoice to send a reminder for.",
    ].join("\n"),
    checks: [
      titleFirst("Invoice INV-2041"),
      ...pairs([["Customer", "Northwind Traders"], ["Issued", "2 Nov 2026"], ["Due", "2 Dec 2026"], ["Amount", "€4,250.00"], ["Status", "Unpaid"]]),
      { id: "reminder", label: "A Send reminder button whose event names INV-2041", test: nodes => buttons(nodes, /remind/i).some(node => toAgent(node) && says(node, ["2041"])) },
    ],
  },
  {
    id: "review-queue",
    prompt: [
      "Show a list of pull requests that wait for review. Each one shows its number, title and author, and has an Open button and an Assign to me button.",
      "Each button must tell the agent which pull request it is for.",
      "Title: \"Waiting for review\".",
      "- #812 Add rate limits to the API, by Ken Ito",
      "- #815 Fix the flaky upload test, by Ana Silva",
      "- #819 Bump Vite to 8.1, by Lee Park",
    ].join("\n"),
    checks: [
      titleFirst("Waiting for review"),
      ...itemChecks([
        { key: "812", texts: ["812", "Add rate limits to the API", "Ken Ito"], ids: ["812", "Add rate limits"] },
        { key: "815", texts: ["815", "Fix the flaky upload test", "Ana Silva"], ids: ["815", "flaky upload"] },
        { key: "819", texts: ["819", "Bump Vite to 8.1", "Lee Park"], ids: ["819", "Bump Vite"] },
      ], [{ name: "Open", label: /open/i }, { name: "Assign to me", label: /assign/i }]),
    ],
  },
  {
    id: "plan-comparison",
    prompt: [
      "Compare three plans in a table with the columns Feature, Starter, Pro and Enterprise. Show each value exactly as written.",
      "Title: \"Compare plans\".",
      "- Price: $0, $20 per seat, Contact us",
      "- Projects: 3, Unlimited, Unlimited",
      "- Single sign-on: No, No, Yes",
      "- Support: Community, Email, 24/7 phone",
    ].join("\n"),
    checks: [
      titleFirst("Compare plans"),
      ...tableChecks(["Feature", "Starter", "Pro", "Enterprise"], [
        ["Price", "$0", "$20 per seat", "Contact us"],
        ["Projects", "3", "Unlimited", "Unlimited"],
        ["Single sign-on", "No", "No", "Yes"],
        ["Support", "Community", "Email", "24/7 phone"],
      ]).map(check => check.id === "headers"
        // "Feature" is the corner cell; a layout with one card per plan has no place for it.
        ? { ...check, label: "Texts start with the plan names Starter, Pro and Enterprise", test: (nodes: LayoutNode[]) => ["Starter", "Pro", "Enterprise"].every(plan => allText(nodes).some(entry => compact(entry).startsWith(compact(plan)))) }
        : check),
    ],
  },
  {
    id: "signup-chart",
    prompt: [
      "Show daily signups for the last 7 days as a chart.",
      "Title: \"Signups this week\".",
      "Mon 120, Tue 98, Wed 143, Thu 160, Fri 131, Sat 64, Sun 59.",
      "There is no chart component, so show one row per day with the day and its number.",
      "Keep the numbers as data (in the state or data model) and bind the texts to them, so the agent can change the numbers later without new components.",
      "Show the total, 775, under the rows.",
    ].join("\n"),
    checks: [
      titleFirst("Signups this week"),
      ...chartChecks([["Mon", "120"], ["Tue", "98"], ["Wed", "143"], ["Thu", "160"], ["Fri", "131"], ["Sat", "64"], ["Sun", "59"]]),
      text("total", "775"),
    ],
  },
  {
    id: "release-card",
    prompt: [
      "Show a card that announces a release.",
      "Title: \"Nuxt 5.2 is out\".",
      "At the top, show the image https://example.com/images/nuxt-5-2.png with the description \"Nuxt 5.2 release banner\".",
      "Then the text \"Faster dev server start and typed server routes.\" and three highlights: \"Dev server starts 40% faster\", \"Typed server routes\", \"New error overlay\".",
      "Add a Read the release notes button that opens https://nuxt.com/blog/v5-2.",
    ].join("\n"),
    checks: [
      titleFirst("Nuxt 5.2 is out"),
      { id: "card", label: "A Card holds the title", test: nodes => nodes.some((node, index) => node.type === "Card" && holds(subtreeText(nodes, index), "Nuxt 5.2 is out")) },
      { id: "image", label: "An Image shows the banner URL", test: nodes => nodes.some(node => node.type === "Image" && node.props.url === "https://example.com/images/nuxt-5-2.png") },
      { id: "image-description", label: "The Image has the description", test: nodes => nodes.some(node => node.type === "Image" && holds([String(node.props.description ?? "")], "Nuxt 5.2 release banner")) },
      {
        id: "image-first",
        label: "The Image comes before the summary text",
        test: (nodes) => {
          const image = nodes.findIndex(node => node.type === "Image")
          const summary = nodes.findIndex(node => holds(node.text, "Faster dev server start"))
          return image >= 0 && summary >= 0 && image < summary
        },
      },
      text("summary", "Faster dev server start and typed server routes."),
      { id: "highlights", label: "The three highlights, in order", test: nodes => inOrder(allText(nodes), ["Dev server starts 40% faster", "Typed server routes", "New error overlay"]) },
      linkButton("notes", "Read the release notes", /release notes|read/i, "https://nuxt.com/blog/v5-2"),
    ],
  },
  {
    id: "build-error",
    prompt: [
      "Show an error report for a failed build.",
      "Title: \"Build failed\".",
      "Show these details as labels and values, exactly as written: Step: vp build; Exit code: 1; File: server/api/invite.post.ts:3:24.",
      "Show the error message \"Cannot find module '@vite-hub/forms'\".",
      "Show these three log lines in order:",
      "vite v8.1.0 building for production",
      "✓ 212 modules transformed.",
      "error during build: Cannot find module '@vite-hub/forms'",
      "Add a Retry build button and a Show full log button. Each button must tell the agent which one the user pressed.",
    ].join("\n"),
    checks: [
      titleFirst("Build failed"),
      ...pairs([["Step", "vp build"], ["Exit code", "1"], ["File", "server/api/invite.post.ts:3:24"]]),
      text("message", "Cannot find module '@vite-hub/forms'"),
      { id: "log", label: "The three log lines, in order", test: nodes => inOrder(allText(nodes), ["vite v8.1.0 building for production", "212 modules transformed", "error during build: Cannot find module"]) },
      agentButton("retry", "Retry build", /retry/i),
      agentButton("full-log", "Show full log", /log/i),
      distinct("distinct-actions", /retry/i, /log/i),
    ],
  },
  {
    id: "rollout-plan",
    prompt: [
      "Show the plan the agent will follow, as numbered steps, each with its status.",
      "Title: \"Plan: move uploads to R2\".",
      ...steps.map(([step, status], index) => `${index + 1}. ${step} (${status})`),
      "Add a Pause plan button that tells the agent to pause.",
    ].join("\n"),
    checks: [
      titleFirst("Plan: move uploads to R2"),
      ...steps.map(([step, status]): RubricCheck => ({
        id: `step-${compact(step).replace(/[^a-z0-9]/g, "").slice(0, 16)}`,
        label: `One component groups "${step}" and "${status}" and no other step`,
        test: nodes => grouped(nodes, { required: [step, status], forbidden: steps.map(entry => entry[0]).filter(other => other !== step) }),
      })),
      { id: "order", label: "The steps appear in order", test: nodes => inOrder(allText(nodes), steps.map(entry => entry[0])) },
      agentButton("pause", "Pause plan", /pause/i),
    ],
  },
  {
    id: "diff-summary",
    prompt: [
      "Show a summary of the changes in a pull request.",
      "Title: \"Changes in #4216\".",
      "One row per file with its path, the lines added and the lines removed, exactly as written:",
      "- packages/kit/src/catalog.ts +212 −40",
      "- packages/kit/test/catalog.test.ts +96 −5",
      "- packages/kit/package.json +3 −1",
      "Then the totals: 3 files, +311 −46.",
      "Add a View diff button that tells the agent to open the full diff.",
    ].join("\n"),
    checks: [
      titleFirst("Changes in #4216"),
      ...[
        ["packages/kit/src/catalog.ts", "+212", "-40"],
        ["packages/kit/test/catalog.test.ts", "+96", "-5"],
        ["packages/kit/package.json", "+3", "-1"],
      ].map((row, _, rows): RubricCheck => ({
        id: `file-${row[0]!.split("/").slice(-2).join("-").replace(/[^a-z0-9-]/g, "")}`,
        label: `One component groups ${row.join(" ")} and no other file`,
        test: nodes => grouped(nodes, { required: row, forbidden: rows.map(entry => entry[0]!).filter(other => other !== row[0]), ordered: true }),
      })),
      {
        id: "totals",
        label: "Texts hold the totals: 3 files, +311 and -46",
        test: nodes => has("+311")(nodes) && has("-46")(nodes)
          && (has("3 files")(nodes) || grouped(nodes, { required: ["3", "file", "+311"], forbidden: ["packages/kit/src", "packages/kit/test", "packages/kit/package.json"] })),
      },
      agentButton("view-diff", "View diff", /diff/i),
    ],
  },
  {
    id: "empty-deployments",
    prompt: [
      "Show an empty state for a project with no deployments yet.",
      "Title: \"No deployments yet\".",
      "Show an icon and the text \"Deploy your app to see it here.\".",
      "Add a Deploy now button that tells the agent to start a deploy, and a Read the deploy guide button that opens https://vitehub.dev/docs/deploy.",
    ].join("\n"),
    checks: [
      titleFirst("No deployments yet"),
      { id: "icon", label: "An Icon", test: nodes => nodes.some(node => node.type === "Icon") },
      text("message", "Deploy your app to see it here."),
      agentButton("deploy", "Deploy now", /deploy now/i),
      linkButton("guide", "Read the deploy guide", /guide/i, "https://vitehub.dev/docs/deploy"),
    ],
  },
  {
    id: "project-tabs",
    prompt: [
      "Show a project overview with three tabs: Overview, Deployments and Settings.",
      "Title: \"acme/web\".",
      "- Overview: the text \"Production runs commit 4f3a2b1, deployed 2 hours ago.\"",
      "- Deployments: a list of three deployments with their state: dpl_81 Ready, dpl_80 Ready, dpl_79 Failed.",
      "- Settings: the labels and values Framework: Nuxt and Node.js: 24.",
    ].join("\n"),
    checks: [
      titleFirst("acme/web"),
      { id: "tabs", label: "A Tabs component with Overview, Deployments and Settings, one child each", test: nodes => tabsNode(nodes)?.children.length === 3 },
      { id: "tab-overview", label: "The Overview tab holds the commit text", test: (nodes) => { const tab = tabChild(nodes, 0); return tab !== undefined && holds(subtreeText(nodes, tab), "Production runs commit 4f3a2b1") } },
      ...[["dpl_81", "Ready"], ["dpl_80", "Ready"], ["dpl_79", "Failed"]].map(([id, state], _, rows): RubricCheck => ({
        id: `tab-deployments-${id}`,
        label: `The Deployments tab groups ${id} and ${state} and no other deployment`,
        test: (nodes) => {
          const tab = tabChild(nodes, 1)
          return tab !== undefined && grouped(nodes, { required: [id!, state!], forbidden: rows.map(row => row[0]!).filter(other => other !== id), within: tab })
        },
      })),
      ...[["Framework", "Nuxt"], ["Node.js", "24"]].map(([label, value], _, rows): RubricCheck => ({
        id: `tab-settings-${compact(label!).replace(/[^a-z]/g, "")}`,
        label: `The Settings tab groups ${label} and ${value}`,
        test: (nodes) => {
          const tab = tabChild(nodes, 2)
          return tab !== undefined && grouped(nodes, { required: [label!, value!], forbidden: rows.map(row => row[0]!).filter(other => other !== label), forbiddenAsLabel: true, within: tab })
        },
      })),
    ],
  },
]

/** The holdout set. It runs only after the main set and is reported apart. */
export const c4Holdout: LayoutTask[] = [
  {
    id: "access-request",
    prompt: [
      "Show an approval card for an access request.",
      "Title: \"Grant Sam Lee admin access to billing\".",
      "Show the reason, \"Close the October books\", and the duration, 24 hours.",
      "Add an Approve button and a Deny button. Each button must tell the agent which choice the user made.",
    ].join("\n"),
    checks: [
      titleFirst("Grant Sam Lee admin access to billing"),
      { id: "card", label: "A Card holds the title", test: nodes => nodes.some((node, index) => node.type === "Card" && holds(subtreeText(nodes, index), "admin access to billing")) },
      text("reason", "Close the October books"),
      text("duration", "24 h"),
      agentButton("approve", "Approve", /approve/i),
      agentButton("deny", "Deny", /deny/i),
      distinct("distinct-actions", /approve/i, /deny/i),
    ],
  },
  {
    id: "team-members",
    prompt: [
      "Show the members of a team as a list. Each member shows name, email and role, and has a Change role button and a Remove button.",
      "Each button must tell the agent which member it is for.",
      "Title: \"Team members\".",
      "- Ana Silva, ana@acme.dev, Owner",
      "- Ken Ito, ken@acme.dev, Admin",
      "- Lee Park, lee@acme.dev, Member",
    ].join("\n"),
    checks: [
      titleFirst("Team members"),
      ...itemChecks([
        { key: "ana@acme.dev", texts: ["Ana Silva", "ana@acme.dev", "Owner"], ids: ["ana@acme.dev", "Ana Silva"] },
        { key: "ken@acme.dev", texts: ["Ken Ito", "ken@acme.dev", "Admin"], ids: ["ken@acme.dev", "Ken Ito"] },
        { key: "lee@acme.dev", texts: ["Lee Park", "lee@acme.dev", "Member"], ids: ["lee@acme.dev", "Lee Park"] },
      ], [{ name: "Change role", label: /role/i }, { name: "Remove", label: /remove/i }]),
    ],
  },
  {
    id: "cost-breakdown",
    prompt: [
      "Show this month's cloud cost per service as a chart.",
      "Title: \"Cost by service, November\".",
      "Workers $412, D1 $96, R2 $58, Queues $21.",
      "There is no chart component, so show one row per service with its name and its cost.",
      "Keep the costs as data (in the state or data model) and bind the texts to them, so the agent can change the costs later without new components.",
      "Show the total, $587, under the rows.",
    ].join("\n"),
    checks: [
      titleFirst("Cost by service, November"),
      ...chartChecks([["Workers", "412"], ["D1", "96"], ["R2", "58"], ["Queues", "21"]]),
      text("total", "587"),
    ],
  },
  {
    id: "test-failures",
    prompt: [
      "Show a report of failed tests.",
      "Title: \"3 tests failed\".",
      "Each failure shows its test name, its error and its file, exactly as written:",
      "- rejects an expired token; Expected 401, received 200; test/auth.test.ts:48",
      "- keeps the draft; Timeout after 5000 ms; test/forms.test.ts:112",
      "- streams large files; ENOSPC: no space left on device; test/blob.test.ts:20",
      "Each failure has a Rerun button that tells the agent which test to run again. Add a Rerun all button too.",
    ].join("\n"),
    checks: [
      titleFirst("3 tests failed"),
      ...itemChecks([
        { key: "test/auth.test.ts:48", texts: ["rejects an expired token", "Expected 401, received 200", "test/auth.test.ts:48"], ids: ["rejects an expired token", "auth.test.ts"] },
        { key: "test/forms.test.ts:112", texts: ["keeps the draft", "Timeout after 5000 ms", "test/forms.test.ts:112"], ids: ["keeps the draft", "forms.test.ts"] },
        { key: "test/blob.test.ts:20", texts: ["streams large files", "ENOSPC: no space left on device", "test/blob.test.ts:20"], ids: ["streams large files", "blob.test.ts"] },
      ], [{ name: "Rerun", label: /rerun(?!.*all)/i }]),
      agentButton("rerun-all", "Rerun all", /rerun all/i),
    ],
  },
]
