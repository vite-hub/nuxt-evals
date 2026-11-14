import { readFileSync } from "node:fs"
import Ajv2020, { type AnySchemaObject, type ErrorObject } from "ajv/dist/2020.js"
import { visibleText, type LayoutNode } from "./tasks.ts"

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value)

const here = new URL("./a2ui/", import.meta.url)
const read = (file: string): AnySchemaObject => JSON.parse(readFileSync(new URL(file, here), "utf8"))
const base = "https://a2ui.org/specification/v1_0/"
const basicCatalog = read("basic_catalog.json")
export const catalogId = String(basicCatalog.catalogId)

// The protocol schema resolves `catalog.json` next to itself, so the basic catalog takes that id.
const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: false })
ajv.addSchema(read("common_types.json"))
ajv.addSchema({ ...basicCatalog, $id: `${base}catalog.json` })
const validateMessage = ajv.compile(read("agent_to_renderer.json"))
const componentNames = Object.keys(isObject(basicCatalog.components) ? basicCatalog.components : {})
const validateComponent = new Map(componentNames.map(name => [name, ajv.compile({
  allOf: [{ $ref: `${base}common_types.json#/$defs/ComponentCommon` }, { $ref: `${base}catalog.json#/components/${name}` }],
  unevaluatedProperties: false,
})]))
/** The spec's naming rule for component ids: a UAX #31 identifier, so `user_card` but not `user-card`. */
const identifier = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u

/**
 * The system prompt the A2UI eval gives a model for its `direct_json` format: the environment notes that
 * `eval/a2ui_eval/strategies/format.py` adds, then `DirectJsonPromptGenerator.generate()` for the v1.0 basic catalog.
 */
export const systemPrompt = () => [
  "## Environment Notes:",
  "- When specifying `catalogId` (in `createSurface` as the surface default, or on individual components and function calls), always use the exact `catalogId` value(s) defined in the provided Catalog Schema(s); never invent a custom or placeholder `catalogId` URL or identifier (such as `example.com`), even if the user prompt mentions a custom catalog.",
  "- In `createSurface`, set `catalogId` to the primary catalog ID as the surface default. Components or functions belonging to secondary catalogs must specify their own `catalogId`.",
  "",
  readFileSync(new URL("direct_json_prompt.txt", here), "utf8").trim(),
].join("\n")

export const userPrompt = (task: string) => task

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }
export type Message = JsonObject


/**
 * Reads the reply like the A2UI SDK's `DirectJsonParser`: every `<a2ui-json>` block, with Markdown fences inside the
 * block removed, holds one message or a JSON array of messages.
 */
export function parseReply(reply: string): { messages?: Message[], error?: string } {
  const open = reply.match(/<a2ui-json>/g)?.length ?? 0
  const blocks = [...reply.matchAll(/<a2ui-json>([\s\S]*?)<\/a2ui-json>/g)].map(match => match[1]!)
  if (!blocks.length) return { error: open ? "An <a2ui-json> block is not closed." : "The reply holds no <a2ui-json> block." }
  if (blocks.length !== open) return { error: "An <a2ui-json> block is not closed." }
  const messages: Message[] = []
  for (const block of blocks) {
    const body = block.trim().replace(/^```[\w-]*\s*/, "").replace(/\s*```$/, "").trim()
    if (!body) return { error: "An <a2ui-json> block is empty." }
    let value: Json
    try {
      value = JSON.parse(body)
    }
    catch (error) {
      return { error: `An <a2ui-json> block is not JSON: ${error instanceof Error ? error.message : String(error)}` }
    }
    for (const message of Array.isArray(value) ? value : [value]) {
      if (!isObject(message)) return { error: "A message is not a JSON object." }
      messages.push(message)
    }
  }
  return { messages }
}

interface Surface {
  components: Map<string, JsonObject>
  data: Json
}

/**
 * Each message against the v1.0 protocol schema with the basic catalog, then the rules the spec and the SDK's strict
 * validation state: a surface is created once with the basic catalog before other messages use it, component ids are
 * unique in a list, and each surface has a `root` component, no dangling references, no cycles and no orphans.
 */
export function check(messages: Message[]): { errors: string[], nodes: LayoutNode[] } {
  const errors: string[] = []
  const surfaces = new Map<string, Surface>()
  messages.forEach((message, index) => {
    if (!validateMessage(message)) {
      errors.push(`message ${index}: ${schemaError(message, validateMessage.errors?.[0])}`)
      return
    }
    const create = message.createSurface
    if (isObject(create)) {
      const id = String(create.surfaceId)
      if (surfaces.has(id)) errors.push(`message ${index}: surface "${id}" already exists`)
      if (create.catalogId !== catalogId) errors.push(`message ${index}: catalogId is not the basic catalog "${catalogId}"`)
      const surface: Surface = { components: new Map(), data: isObject(create.dataModel) ? create.dataModel : {} }
      surfaces.set(id, surface)
      addComponents(surface, create.components, index, errors)
      return
    }
    for (const kind of ["updateComponents", "updateDataModel", "deleteSurface"]) {
      const body = message[kind]
      if (!isObject(body)) continue
      const id = String(body.surfaceId)
      const surface = surfaces.get(id)
      if (!surface) {
        errors.push(`message ${index}: ${kind} for surface "${id}" before createSurface`)
        continue
      }
      if (kind === "updateComponents") addComponents(surface, body.components, index, errors)
      if (kind === "updateDataModel") surface.data = setPointer(surface.data, typeof body.path === "string" ? body.path : "/", body.value ?? null)
      if (kind === "deleteSurface") surfaces.delete(id)
    }
  })
  if (!surfaces.size && !errors.length) errors.push("No surface is created.")
  const nodes: LayoutNode[] = []
  for (const [id, surface] of surfaces) {
    errors.push(...topology(id, surface))
    build(surface, "root", "", nodes, [])
  }
  return { errors: [...new Set(errors)], nodes }
}

/** The first schema error, made precise for a component: the oneOf over all components only reports its first branch. */
function schemaError(message: Message, first: ErrorObject | undefined): string {
  const path = first?.instancePath ?? ""
  const match = /^\/(createSurface|updateComponents)\/components\/(\d+)/.exec(path)
  const body = match ? message[match[1]!] : undefined
  const list = isObject(body) ? body.components : undefined
  const component = match && Array.isArray(list) ? list[Number(match[2])] : undefined
  if (match && isObject(component)) {
    const type = String(component.component)
    const id = String(component.id)
    const validate = validateComponent.get(type)
    if (!validate) return `${match[0]} has unknown component "${type}"`
    if (!validate(component)) {
      const error = validate.errors?.[0]
      return `${match[0]}${error?.instancePath ?? ""} (${type} "${id}") ${error?.message ?? ""}`
    }
  }
  return `${path || "/"} ${first?.message ?? "does not match the schema"}`
}

function addComponents(surface: Surface, list: Json | undefined, index: number, errors: string[]) {
  if (!Array.isArray(list)) return
  const seen = new Set<string>()
  for (const component of list) {
    if (!isObject(component)) continue
    const id = String(component.id)
    if (!identifier.test(id)) errors.push(`message ${index}: component id "${id}" is not a UAX #31 identifier`)
    if (seen.has(id)) errors.push(`message ${index}: component id "${id}" appears twice`)
    seen.add(id)
    surface.components.set(id, component)
  }
}

/** Component ids a component points to, with the scope path a templated list adds. */
function references(component: JsonObject): { id: string, template?: string }[] {
  const refs: { id: string, template?: string }[] = []
  for (const key of ["child", "trigger", "content"]) {
    const value = component[key]
    if (typeof value === "string") refs.push({ id: value })
  }
  const children = component.children
  if (Array.isArray(children)) refs.push(...children.filter(child => typeof child === "string").map(id => ({ id })))
  else if (isObject(children) && typeof children.componentId === "string") refs.push({ id: children.componentId, template: String(children.path) })
  if (Array.isArray(component.tabs)) {
    for (const tab of component.tabs) if (isObject(tab) && typeof tab.child === "string") refs.push({ id: tab.child })
  }
  return refs
}

function topology(surfaceId: string, surface: Surface): string[] {
  const errors: string[] = []
  const { components } = surface
  if (!components.has("root")) return [`surface "${surfaceId}": no component has id "root"`]
  for (const [id, component] of components) {
    for (const ref of references(component)) {
      if (ref.id === id) errors.push(`surface "${surfaceId}": component "${id}" references itself`)
      else if (!components.has(ref.id)) errors.push(`surface "${surfaceId}": component "${id}" references missing component "${ref.id}"`)
    }
  }
  const visited = new Set<string>()
  const stack = new Set<string>()
  const visit = (id: string) => {
    visited.add(id)
    stack.add(id)
    for (const ref of references(components.get(id) ?? {})) {
      if (!components.has(ref.id) || ref.id === id) continue
      if (stack.has(ref.id)) errors.push(`surface "${surfaceId}": cycle through component "${ref.id}"`)
      else if (!visited.has(ref.id)) visit(ref.id)
    }
    stack.delete(id)
  }
  visit("root")
  const orphans = [...components.keys()].filter(id => !visited.has(id)).sort()
  if (orphans.length) errors.push(`surface "${surfaceId}": component "${orphans[0]}" is not reachable from "root"`)
  return errors
}

const unescape = (segment: string) => segment.replace(/~1/g, "/").replace(/~0/g, "~")
const segments = (pointer: string) => pointer.split("/").slice(1).filter(Boolean).map(unescape)

function getPointer(data: Json, pointer: string): Json | undefined {
  let current: Json | undefined = data
  for (const segment of segments(pointer)) {
    if (Array.isArray(current)) current = current[Number(segment)]
    else if (isObject(current)) current = current[segment]
    else return undefined
  }
  return current
}

function setPointer(data: Json, pointer: string, value: Json): Json {
  const keys = segments(pointer)
  if (!keys.length) return value
  const root: Json = isObject(data) || Array.isArray(data) ? data : {}
  let current: Json = root
  keys.forEach((key, index) => {
    const last = index === keys.length - 1
    if (Array.isArray(current)) {
      if (last) current[Number(key)] = value
      else current = current[Number(key)] ??= {}
    }
    else if (isObject(current)) {
      if (last) current[key] = value
      else current = current[key] ??= {}
    }
  })
  return root
}

const absolute = (path: string, scope: string) => path.startsWith("/") ? path : `${scope}/${path}`

function resolve(value: Json | undefined, surface: Surface, scope: string): Json | undefined {
  if (Array.isArray(value)) return value.map(entry => resolve(entry, surface, scope) ?? null)
  if (!isObject(value)) return value
  if (typeof value["@path"] === "string") return getPointer(surface.data, absolute(value["@path"], scope))
  if (typeof value["@call"] === "string") {
    const args = isObject(value.args) ? value.args : {}
    if (value["@call"] === "formatString" && typeof args.value === "string") {
      const paths = args.value.replace(/(?<!\\)\$\{([\w/~.-]+)\}/g, (match, expression: string) => {
        const resolved = getPointer(surface.data, absolute(expression, scope))
        return resolved === undefined || isObject(resolved) ? match : String(resolved)
      })
      // A nested formatting call, such as `${formatNumber(value:${/total}, decimals:0)}`, shows its value argument.
      return paths.replace(/(?<!\\)\$\{\w+\(([^()]*)\)\}/g, (match, list: string) => /(?:^|,)\s*value\s*:\s*([^,]*)/.exec(list)?.[1]?.trim() ?? match)
    }
    const first = resolve(args.value, surface, scope)
    return first === undefined || isObject(first) ? undefined : String(first)
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolve(entry, surface, scope) ?? null]))
}

/**
 * An action with its data references read. A `functionCall` action names a client function, such as `openUrl`, that
 * runs when the button is pressed, so its arguments are read but the call itself is not evaluated.
 */
function resolveAction(action: Json, surface: Surface, scope: string): Json | undefined {
  const call = isObject(action) ? action.functionCall : undefined
  if (isObject(call)) return { functionCall: { ...call, args: resolve(call.args, surface, scope) ?? null } }
  return resolve(action, surface, scope)
}

function build(surface: Surface, id: string, scope: string, nodes: LayoutNode[], path: string[]): number | undefined {
  const component = surface.components.get(id)
  if (!component || path.includes(id) || path.length > 40) return undefined
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(component)) {
    if (key !== "id" && key !== "component" && !key.startsWith("@")) props[key] = resolve(value, surface, scope)
  }
  const value = component.value
  const bound = Object.entries(component).filter(([key, entry]) => key !== "action" && isObject(entry) && ("@path" in entry || "@call" in entry)).map(([key]) => key)
  const node: LayoutNode = {
    type: String(component.component),
    text: visibleText(props),
    props,
    ...(component.action !== undefined ? { action: JSON.stringify(component.action), actionValue: JSON.stringify(resolveAction(component.action, surface, scope)) } : {}),
    ...(bound.length ? { bound } : {}),
    ...(isObject(value) && typeof value["@path"] === "string" ? { bind: absolute(value["@path"], scope) } : {}),
    children: [],
  }
  const index = nodes.push(node) - 1
  for (const ref of references(component)) {
    const scopes = ref.template === undefined ? [scope] : templateScopes(surface, absolute(ref.template, scope))
    for (const childScope of scopes) {
      const child = build(surface, ref.id, childScope, nodes, [...path, id])
      if (child !== undefined) node.children.push(child)
    }
  }
  return index
}

function templateScopes(surface: Surface, path: string): string[] {
  const items = getPointer(surface.data, path)
  return Array.isArray(items) ? items.map((_, index) => `${path.replace(/\/$/, "")}/${index}`) : []
}

/** Writes messages as the `<a2ui-json>` block that the A2UI prompt asks for. */
export const toReply = (messages: Message[]) => `<a2ui-json>\n${JSON.stringify(messages, null, 2)}\n</a2ui-json>`
