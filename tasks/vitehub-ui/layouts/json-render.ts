import {
  buildUserPrompt,
  compileSpecStream,
  defineCatalog,
  evaluateVisibility,
  getByPath,
  resolveBindings,
  resolveElementProps,
  resolveRepeatStatePath,
  validateSpec,
  type ActionBinding,
  type PropResolutionContext,
  type Spec,
  type UIElement,
} from "@json-render/core"
import { schema } from "@json-render/vue/schema"
import { z } from "zod"
import { visibleText, type LayoutNode } from "./tasks.ts"

const dynamicString = z.string()
const align = z.enum(["start", "center", "end", "stretch"]).nullish()
const justify = z.enum(["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly", "stretch"]).nullish()

/**
 * The A2UI v1.0 basic catalog, component for component, written the json-render way: children through the
 * `children` array or named slots, a Button label prop, and actions bound through `on.press`. The one catalog action
 * matches A2UI's `event` action: it sends a named event with context to the agent.
 */
export const catalog = defineCatalog(schema, {
  components: {
    Column: {
      props: z.object({ justify, align }),
      slots: ["default"],
      description: "Arranges its children vertically. To create a grid layout, nest Rows within this Column.",
    },
    Text: {
      props: z.object({ text: dynamicString, variant: z.enum(["caption", "body"]).nullish() }),
      description: "Displays text. Simple Markdown is supported (no HTML, images or links).",
      example: { text: "Hello" },
    },
    Row: {
      props: z.object({ justify, align }),
      slots: ["default"],
      description: "Arranges its children horizontally. To create a grid layout, nest Columns within this Row.",
    },
    List: {
      props: z.object({ direction: z.enum(["vertical", "horizontal"]).nullish(), align }),
      slots: ["default"],
      description: "A list of children.",
    },
    Card: {
      props: z.object({}),
      slots: ["default"],
      description: "A card container for its children.",
    },
    Image: {
      props: z.object({
        url: dynamicString,
        description: dynamicString.nullish(),
        fit: z.enum(["contain", "cover", "fill", "none", "scaleDown"]).nullish(),
        variant: z.enum(["icon", "avatar", "smallFeature", "mediumFeature", "largeFeature", "header"]).nullish(),
      }),
      description: "Displays an image.",
    },
    Icon: {
      props: z.object({ name: z.string() }),
      description: "Displays an icon by name, for example check, close, warning, info, settings, person, mail.",
    },
    Video: {
      props: z.object({ url: dynamicString, posterUrl: dynamicString.nullish() }),
      description: "Plays a video.",
    },
    AudioPlayer: {
      props: z.object({ url: dynamicString, description: dynamicString.nullish() }),
      description: "Plays audio.",
    },
    Tabs: {
      props: z.object({ tabs: z.array(z.object({ title: dynamicString })).min(1) }),
      slots: ["default"],
      description: "Tabs. One child per tab, in the order of tabs.",
    },
    Modal: {
      props: z.object({}),
      slots: ["trigger", "content"],
      description: "A modal dialog. The trigger slot holds the component that opens it, the content slot what it shows.",
    },
    Divider: {
      props: z.object({ axis: z.enum(["horizontal", "vertical"]).nullish() }),
      description: "A divider line.",
    },
    Button: {
      props: z.object({ label: dynamicString, variant: z.enum(["default", "primary", "borderless"]).nullish() }),
      events: ["press"],
      description: "A clickable button. Bind on.press to an action.",
      example: { label: "Submit", variant: "primary" },
    },
    TextField: {
      props: z.object({
        label: dynamicString,
        value: dynamicString.nullish(),
        placeholder: dynamicString.nullish(),
        variant: z.enum(["longText", "number", "shortText", "obscured"]).nullish(),
      }),
      description: "A text input. Use { $bindState } on value for two-way binding.",
    },
    CheckBox: {
      props: z.object({ label: dynamicString, value: z.boolean().nullish() }),
      description: "A checkbox. Use { $bindState } on value for two-way binding.",
    },
    ChoicePicker: {
      props: z.object({
        label: dynamicString.nullish(),
        variant: z.enum(["multipleSelection", "mutuallyExclusive"]).nullish(),
        options: z.array(z.object({ label: dynamicString, value: z.string() })),
        value: z.array(z.string()).nullish(),
        displayStyle: z.enum(["checkbox", "chips"]).nullish(),
        filterable: z.boolean().nullish(),
      }),
      description: "Selects one or more options. value is the list of selected option values; use { $bindState } on it for two-way binding.",
    },
    Slider: {
      props: z.object({ label: dynamicString.nullish(), min: z.number().nullish(), max: z.number(), value: z.number().nullish(), steps: z.number().int().nullish() }),
      description: "A slider. Use { $bindState } on value for two-way binding.",
    },
    DateTimeInput: {
      props: z.object({ label: dynamicString.nullish(), value: dynamicString.nullish(), enableDate: z.boolean().nullish(), enableTime: z.boolean().nullish(), min: z.string().nullish(), max: z.string().nullish() }),
      description: "A date and time input. Use { $bindState } on value for two-way binding.",
    },
  },
  actions: {
    event: {
      params: z.object({ name: z.string(), context: z.record(z.string(), z.unknown()).nullish() }),
      description: "Sends a named event to the agent. Params: { name: string, context?: object }. Context values can read state with { \"$state\": \"/path\" }.",
    },
  },
})

type ComponentName = keyof typeof catalog.data.components

/** json-render's own system prompt for this catalog, in its default standalone mode (JSONL patches only). */
export const systemPrompt = () => catalog.prompt()

export const userPrompt = (task: string) => buildUserPrompt({ prompt: task })

export interface JsonRenderParse {
  spec?: Record<string, unknown>
  error?: string
  /** Lines that json-render's stream compiler skips: prose and code fences. */
  skippedLines: number
}

/**
 * Reads the reply the way json-render's client does, with `compileSpecStream`. That compiler skips any line that is
 * not a patch, so a line that starts like JSON but does not parse as a patch counts as a parse error here.
 */
export function parseReply(reply: string): JsonRenderParse {
  const lines = reply.split("\n").map(line => line.trim()).filter(Boolean)
  const broken = lines.filter(line => line.startsWith("{") && !isPatch(line))
  const patches = lines.filter(line => line.startsWith("{") && isPatch(line))
  const skippedLines = lines.length - patches.length
  if (broken.length) return { error: `Line is not a JSON patch: ${broken[0]!.slice(0, 120)}`, skippedLines }
  if (!patches.length) return { error: "The reply holds no JSON patch lines.", skippedLines }
  try {
    return { spec: compileSpecStream(reply), skippedLines }
  }
  catch (error) {
    return { error: `A patch does not apply: ${error instanceof Error ? error.message : String(error)}`, skippedLines }
  }
}

function isPatch(line: string): boolean {
  try {
    const value: unknown = JSON.parse(line)
    return typeof value === "object" && value !== null && "op" in value && "path" in value
  }
  catch {
    return false
  }
}

const builtInActions = new Set((schema.builtInActions ?? []).map(action => action.name))

/**
 * json-render's own checks: the catalog's Zod schema for the spec, `validateSpec` for the structure, each element's
 * props against its component's Zod schema after its expressions resolve (as `@json-render/chat` does), and every
 * bound action in the catalog ("Action name (must be in catalog)" in `ActionBinding`).
 */
export function check(spec: Record<string, unknown>): { errors: string[], nodes: LayoutNode[] } {
  const errors: string[] = []
  const parsed = catalog.validate(spec)
  if (!parsed.success) errors.push(...(parsed.error?.issues ?? []).map(issue => `${issue.path.join(".")}: ${issue.message}`))
  const nodes: LayoutNode[] = []
  if (isSpec(spec)) {
    const structure = validateSpec(spec)
    errors.push(...structure.issues.filter(issue => issue.severity === "error").map(issue => issue.message))
    walk(spec, spec.root, { stateModel: spec.state ?? {} }, nodes, errors, [])
  }
  return { errors: [...new Set(errors)], nodes }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

function isSpec(value: Record<string, unknown>): value is Record<string, unknown> & Spec {
  const { root, elements, state } = value
  return typeof root === "string" && isObject(elements) && Object.values(elements).every(element => isObject(element) && typeof element.type === "string")
    && (state === undefined || isObject(state))
}

function walk(spec: Spec, key: string, context: PropResolutionContext, nodes: LayoutNode[], errors: string[], path: string[]): number | undefined {
  const element: UIElement | undefined = spec.elements[key]
  if (!element || path.includes(key) || path.length > 40) return undefined
  if (element.visible !== undefined && !evaluateVisibility(element.visible, context)) return undefined
  const definition = catalog.data.components[element.type as ComponentName]
  const raw = element.props ?? {}
  const resolved = resolveElementProps(raw, context)
  const result = definition?.props.safeParse(resolved)
  if (result && !result.success) errors.push(...result.error.issues.map(issue => `${key}.props.${issue.path.join(".")}: ${issue.message}`))
  // Zod drops props the component does not declare, so the renderer never shows them.
  const props: Record<string, unknown> = result?.success ? result.data : resolved
  const events: readonly string[] = definition && "events" in definition ? definition.events : []
  const bindings = events.flatMap(event => [element.on?.[event] ?? []].flat())
  for (const binding of Object.values(element.on ?? {}).flat()) {
    if (!catalog.actionNames.includes(binding.action) && !builtInActions.has(binding.action)) errors.push(`${key}: unknown action "${binding.action}"`)
    else if (binding.action === "event") {
      const result = catalog.data.actions.event.params.safeParse(binding.params ?? {})
      if (!result.success) errors.push(...result.error.issues.map(issue => `${key}.on.params.${issue.path.join(".")}: ${issue.message}`))
    }
  }
  const node: LayoutNode = {
    type: element.type,
    text: visibleText(props),
    props,
    ...(bindings.length ? { action: JSON.stringify(bindings.length === 1 ? bindings[0] : bindings satisfies ActionBinding[]) } : {}),
    ...(resolveBindings(raw, context)?.value ? { bind: resolveBindings(raw, context)!.value } : {}),
    children: [],
  }
  const index = nodes.push(node) - 1
  const childKeys = [...(element.children ?? []), ...Object.values(element.slots ?? {}).flat()]
  const scopes = element.repeat ? repeatScopes(spec, element.repeat.statePath, context) : [context]
  for (const scope of scopes) {
    for (const child of childKeys) {
      const childIndex = walk(spec, child, scope, nodes, errors, [...path, key])
      if (childIndex !== undefined) node.children.push(childIndex)
    }
  }
  return index
}

function repeatScopes(spec: Spec, statePath: NonNullable<UIElement["repeat"]>["statePath"], context: PropResolutionContext): PropResolutionContext[] {
  const base = resolveRepeatStatePath(statePath, context.repeatBasePath)
  const items = base === undefined ? undefined : getByPath(spec.state ?? {}, base)
  if (!Array.isArray(items)) return []
  return items.map((item, index) => ({ ...context, repeatItem: item, repeatIndex: index, repeatBasePath: `${base}/${index}` }))
}

/** Writes a spec as the JSONL patches that json-render's prompt asks for. */
export function toReply(spec: Spec): string {
  const lines: { op: "add", path: string, value: unknown }[] = [{ op: "add", path: "/root", value: spec.root }]
  for (const [key, element] of Object.entries(spec.elements)) lines.push({ op: "add", path: `/elements/${key}`, value: element })
  for (const [key, value] of Object.entries(spec.state ?? {})) lines.push({ op: "add", path: `/state/${key}`, value })
  return lines.map(line => JSON.stringify(line)).join("\n")
}
