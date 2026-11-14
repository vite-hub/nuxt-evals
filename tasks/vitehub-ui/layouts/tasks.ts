/**
 * One rendered component. Each format's adapter turns a parsed spec into a list of these in reading order (depth first
 * from the root), with data bindings resolved and repeated or templated children expanded.
 */
export interface LayoutNode {
  /** The catalog component name. Both catalogs use the A2UI basic catalog names. */
  type: string
  /** The visible strings of this component alone: text, label, title, option labels. */
  text: string[]
  /** Resolved props. */
  props: Record<string, unknown>
  /** The raw action binding of a pressable component, as JSON. Unset when no action is bound. */
  action?: string
  /** The same action with its data references resolved to values in this node's scope, as JSON: what the agent gets. */
  actionValue?: string
  /** The props whose value is a data reference ($state, $item, $template, @path, formatString and the like). */
  bound?: string[]
  /** The data path that an input's value is bound to. */
  bind?: string
  /** Indexes of the child nodes in the list. */
  children: number[]
}

export interface RubricCheck {
  id: string
  label: string
  test: (nodes: LayoutNode[]) => boolean
}

export interface LayoutTask {
  id: string
  prompt: string
  checks: RubricCheck[]
}

/** The visible strings of a component's resolved props. */
export function visibleText(props: Record<string, unknown>): string[] {
  const texts: string[] = []
  for (const key of ["text", "label", "title", "description", "placeholder"]) {
    const value = props[key]
    if (typeof value === "string" || typeof value === "number") texts.push(String(value))
  }
  for (const key of ["options", "tabs"]) {
    const list = props[key]
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (entry && typeof entry === "object") {
        const label = "label" in entry ? entry.label : "title" in entry ? entry.title : undefined
        if (typeof label === "string") texts.push(label)
      }
    }
  }
  return texts
}

export const compact = (value: string) => value.toLowerCase().replace(/[*_`#]/g, "").replace(/[−–—]/g, "-").replace(/\s+/g, "")

function subtree(nodes: LayoutNode[], index: number): string[] {
  const node = nodes[index]
  if (!node) return []
  return [...node.text, ...node.children.flatMap(child => subtree(nodes, child))]
}

const holds = (texts: string[], value: string) => texts.some(text => compact(text).includes(compact(value)))
const allText = (nodes: LayoutNode[]) => nodes.flatMap(node => node.text)
const has = (value: string) => (nodes: LayoutNode[]) => holds(allText(nodes), value)

/** One of the first two visible strings in reading order holds the title. A short label above it, like "Approval required", is fine. */
const titleFirst = (title: string): RubricCheck => ({
  id: "title",
  label: `The title "${title}" is one of the first two texts`,
  test: nodes => allText(nodes).filter(text => text.trim()).slice(0, 2).some(text => compact(text).includes(compact(title))),
})

/** Some component groups every required value and none of the forbidden ones, like one table row. */
function grouped(nodes: LayoutNode[], required: string[], forbidden: string[]) {
  return nodes.some((_, index) => {
    const texts = subtree(nodes, index)
    return required.every(value => holds(texts, value)) && !forbidden.some(value => holds(texts, value))
  })
}

const buttons = (nodes: LayoutNode[], label: RegExp) =>
  nodes.filter((node, index) => node.type === "Button" && subtree(nodes, index).some(text => label.test(text)))

const wiredButton = (id: string, label: string, pattern: RegExp): RubricCheck => ({
  id,
  label: `A ${label} button with a bound action`,
  test: nodes => buttons(nodes, pattern).some(node => node.action !== undefined),
})

const services = [
  ["api", "us-east-1", "healthy", "42 ms"],
  ["web", "eu-west-1", "healthy", "88 ms"],
  ["worker", "us-east-1", "degraded", "310 ms"],
  ["billing", "ap-south-1", "down", "timeout"],
]

const settings = [
  ["Plan", "Pro"],
  ["Seats", "8 of 10"],
  ["Region", "eu-west-1"],
  ["Two-factor", "Required"],
]

const field = (nodes: LayoutNode[], type: string, label: RegExp) =>
  nodes.find(node => node.type === type && node.text.some(text => label.test(text)))

export const tasks: LayoutTask[] = [
  {
    id: "deploy-approval",
    prompt: [
      "Show an approval card for a deploy.",
      "Title: \"Deploy acme/web to production\".",
      "Show the author, Dana Reyes, and the diff summary: 12 files changed, +340 −87.",
      "Add an Approve button and a Reject button. Each button must tell the agent which choice the user made.",
    ].join("\n"),
    checks: [
      titleFirst("Deploy acme/web to production"),
      { id: "card", label: "The layout uses a Card", test: nodes => nodes.some(node => node.type === "Card") },
      { id: "author", label: "A text holds the author Dana Reyes", test: has("Dana Reyes") },
      { id: "files", label: "A text holds the 12 changed files", test: nodes => allText(nodes).some(text => /\b12\b/.test(text) && /file/i.test(text)) || grouped(nodes, ["12", "file"], ["Dana", "Approve"]) },
      { id: "additions", label: "A text holds +340", test: has("+340") },
      { id: "deletions", label: "A text holds −87 or -87", test: has("-87") },
      wiredButton("approve", "Approve", /approve/i),
      wiredButton("reject", "Reject", /reject/i),
      {
        id: "distinct-actions",
        label: "Approve and Reject send different actions",
        test: (nodes) => {
          const approve = buttons(nodes, /approve/i).find(node => node.action)?.action
          const reject = buttons(nodes, /reject/i).find(node => node.action)?.action
          return Boolean(approve && reject && approve !== reject)
        },
      },
    ],
  },
  {
    id: "service-status",
    prompt: [
      "Show a status table of 4 services with the columns Name, Region, Status and Latency.",
      "Title: \"Service status\".",
      ...services.map(row => `- ${row.join(", ")}`),
    ].join("\n"),
    checks: [
      titleFirst("Service status"),
      {
        id: "columns",
        label: "Texts hold the column labels Name, Region, Status and Latency",
        test: nodes => ["Name", "Region", "Latency"].every(label => has(label)(nodes))
          && allText(nodes).filter(text => /status/i.test(text)).length >= 2,
      },
      ...services.map(([name, ...values]): RubricCheck => ({
        id: `row-${name}`,
        label: `One component groups ${name}, ${values.join(", ")} and no other service`,
        test: nodes => grouped(nodes, [name!, ...values], services.map(row => row[0]!).filter(other => other !== name)),
      })),
      {
        id: "four-rows",
        label: "Each service name appears in exactly one text",
        test: nodes => services.every(([name]) => allText(nodes).filter(text => new RegExp(`\\b${name}\\b`, "i").test(text)).length === 1),
      },
    ],
  },
  {
    id: "settings-summary",
    prompt: [
      "Show a settings summary for the workspace Acme.",
      "Title: \"Workspace settings\".",
      "Show each setting as a label and its value:",
      "- Plan: Pro",
      "- Seats: 8 of 10 used",
      "- Region: eu-west-1",
      "- Two-factor sign-in: Required",
      "Add an Edit settings button that tells the agent to open the settings editor.",
    ].join("\n"),
    checks: [
      titleFirst("Workspace settings"),
      { id: "workspace", label: "A text holds the workspace name Acme", test: has("Acme") },
      ...settings.map(([label, value]): RubricCheck => ({
        id: `setting-${label!.toLowerCase()}`,
        label: `One component groups ${label} and ${value} and no other setting`,
        test: nodes => grouped(nodes, [label!, value!], settings.map(row => row[0]!).filter(other => other !== label)),
      })),
      wiredButton("edit", "Edit settings", /edit/i),
    ],
  },
  {
    id: "invite-form",
    prompt: [
      "Show a form to invite a teammate.",
      "Title: \"Invite a teammate\".",
      "It has an email field, a role choice with the options Admin, Member and Viewer (Member is selected), and a Send invite button.",
      "The button must send the email and the role to the agent.",
    ].join("\n"),
    checks: [
      titleFirst("Invite a teammate"),
      {
        id: "email-field",
        label: "A TextField labeled Email with a bound value",
        test: nodes => Boolean(field(nodes, "TextField", /e-?mail/i)?.bind),
      },
      {
        id: "role-choice",
        label: "A ChoicePicker with Admin, Member and Viewer and a bound value",
        test: (nodes) => {
          const picker = nodes.find(node => node.type === "ChoicePicker" && ["Admin", "Member", "Viewer"].every(option => holds(node.text, option)))
          return Boolean(picker?.bind)
        },
      },
      {
        id: "member-selected",
        label: "Member is the selected role",
        test: (nodes) => {
          const value = nodes.find(node => node.type === "ChoicePicker")?.props.value
          const selected = Array.isArray(value) ? value : [value]
          return selected.length === 1 && compact(String(selected[0])) === "member"
        },
      },
      wiredButton("send", "Send invite", /send|invite/i),
      {
        id: "sends-values",
        label: "The Send invite action reads the email and role bindings",
        test: (nodes) => {
          const action = buttons(nodes, /send|invite/i).find(node => node.action)?.action ?? ""
          const email = field(nodes, "TextField", /e-?mail/i)?.bind
          const role = nodes.find(node => node.type === "ChoicePicker")?.bind
          // The role binding may hold a list, so a path into it ("/role/0") reads it too.
          const reads = (path: string) => action.includes(`"${path}"`) || action.includes(`"${path}/`)
          return Boolean(email && role && reads(email) && reads(role))
        },
      },
    ],
  },
]

export function findTask(id: string): LayoutTask {
  const task = tasks.find(entry => entry.id === id)
  if (!task) throw new Error(`Unknown task ${id}. Known: ${tasks.map(entry => entry.id).join(", ")}.`)
  return task
}
