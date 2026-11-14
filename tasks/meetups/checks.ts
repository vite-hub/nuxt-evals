// A small client for scripted checks against a running Meetups app (the base app or an agent's fix of it): visitors
// with their own cookies and their own loopback address, sign-up, events, RSVPs. Each visitor sends from 127.0.0.<n>,
// so the app's per-address sign-up limits see different clients.
import { type IncomingHttpHeaders, request } from "node:http"
import type { ScriptedResult } from "../types.ts"

export interface Reply {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
  text: string
  json<T = any>(): T
}

let addresses = 0
/** A run-unique tag for emails and titles, so checks never collide with each other's data. */
export const tag = () => Math.random().toString(36).slice(2, 8)

export class Visitor {
  readonly cookies = new Map<string, string>()
  readonly origin: string
  readonly address: string
  user?: { id: string, email: string, name: string }

  constructor(origin: string, address?: string) {
    this.origin = origin
    this.address = address ?? `127.0.0.${10 + (addresses++ % 240)}`
  }

  /** Another visitor that talks to `origin` (a second server of the same app) with this visitor's cookies. */
  on(origin: string): Visitor {
    const other = new Visitor(origin, this.address)
    for (const [name, value] of this.cookies) other.cookies.set(name, value)
    other.user = this.user
    return other
  }

  async send(method: string, path: string, options: { json?: unknown, body?: Buffer, headers?: Record<string, string> } = {}): Promise<Reply> {
    const url = new URL(path, this.origin)
    const body = options.json !== undefined ? Buffer.from(JSON.stringify(options.json)) : options.body
    const headers: Record<string, string> = {
      host: url.host,
      origin: this.origin,
      accept: "application/json, text/html;q=0.9",
      ...(options.json !== undefined ? { "content-type": "application/json" } : {}),
      ...(body ? { "content-length": String(body.length) } : {}),
      ...(this.cookies.size ? { cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ") } : {}),
      ...options.headers,
    }
    return await new Promise<Reply>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port: url.port, path: `${url.pathname}${url.search}`, method, headers, localAddress: this.address, timeout: 60_000 }, (res) => {
        const chunks: Buffer[] = []
        res.on("data", chunk => chunks.push(chunk))
        res.on("end", () => {
          for (const line of res.headers["set-cookie"] ?? []) {
            const [pair] = line.split(";")
            const index = pair!.indexOf("=")
            const name = pair!.slice(0, index).trim()
            const value = pair!.slice(index + 1).trim()
            if (/max-age=0|expires=thu, 01 jan 1970/i.test(line) || !value) this.cookies.delete(name)
            else this.cookies.set(name, value)
          }
          const buffer = Buffer.concat(chunks)
          const text = buffer.toString("utf8")
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: buffer, text, json: () => JSON.parse(text) })
        })
      })
      req.on("timeout", () => req.destroy(new Error(`${method} ${path} timed out`)))
      req.on("error", reject)
      req.end(body)
    })
  }

  get(path: string) {
    return this.send("GET", path)
  }

  /** GETs JSON and throws with the status and body when the answer isn't a 200 with JSON. */
  async getJson<T = any>(path: string): Promise<T> {
    const reply = await this.send("GET", path)
    if (reply.status !== 200) throw new Error(`GET ${path} answered ${reply.status}: ${reply.text.slice(0, 300)}`)
    try {
      return reply.json<T>()
    }
    catch {
      throw new Error(`GET ${path} answered something that isn't JSON: ${reply.text.slice(0, 300)}`)
    }
  }

  /** Creates an account and keeps its session cookie. */
  async signUp(label = "user"): Promise<this> {
    const email = `check-${label}-${tag()}@example.test`
    const name = `Check ${label}`
    const reply = await this.send("POST", "/api/auth/sign-up/email", { json: { name, email, password: "check-password-123" } })
    if (reply.status !== 200) throw new Error(`Sign-up of ${email} answered ${reply.status}: ${reply.text.slice(0, 200)}`)
    this.user = { id: reply.json().user?.id, email, name }
    return this
  }

  /** Creates an event `days` from now and returns its slug. */
  async createEvent(input: { title?: string, capacity?: number, city?: string, days?: number } = {}): Promise<string> {
    const start = new Date(Date.now() + (input.days ?? 5) * 86_400_000)
    const local = start.toISOString().slice(0, 13) + ":00"
    const reply = await this.send("POST", "/api/events", {
      json: {
        title: input.title ?? `Check meetup ${tag()}`,
        description: "A meetup the grading script made to test the app.",
        city: input.city ?? "Lisbon",
        venue: "Check Hall",
        startsAtLocal: local,
        timeZone: "UTC",
        capacity: input.capacity ?? 50,
        priceCents: 0,
      },
    })
    if (reply.status !== 201 && reply.status !== 200) throw new Error(`Creating an event answered ${reply.status}: ${reply.text.slice(0, 300)}`)
    return reply.json<{ slug: string }>().slug
  }
}

/** Signs up `count` visitors, a few at a time. */
export async function signUpMany(origin: string, count: number, label: string): Promise<Visitor[]> {
  const visitors: Visitor[] = []
  for (let index = 0; index < count; index += 5) {
    visitors.push(...await Promise.all(Array.from({ length: Math.min(5, count - index) }, (_, offset) => new Visitor(origin).signUp(`${label}${index + offset}`))))
  }
  return visitors
}

/** A 1×1 PNG. */
export const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")

/** A multipart body with one file field. */
export function multipart(field: string, file: { name: string, type: string, data: Buffer }): { body: Buffer, headers: Record<string, string> } {
  const boundary = `----check${tag()}`
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`)
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return { body: Buffer.concat([head, file.data, tail]), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } }
}

export const pass = (evidence: string): ScriptedResult => ({ outcome: "pass", evidence })
export const fail = (evidence: string): ScriptedResult => ({ outcome: "fail", evidence })
