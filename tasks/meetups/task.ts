import { join } from "node:path"
import type { Page } from "playwright-core"
import type { Probe, ProbeOutcome, Task, TaskFile } from "../types.ts"
import { hasTitle, listPage, type MeetupsRuntime, type PageLog, publicAssets, sampleEvent, startMeetups } from "./harness.ts"
import { listEvents } from "./fixture/server/data/events.ts"

type MeetupsProbe = Probe<MeetupsRuntime>

const pass = (detail?: string): ProbeOutcome => ({ passed: true, ...(detail ? { detail } : {}) })
const fail = (detail: string): ProbeOutcome => ({ passed: false, detail })

/** Waits until the page text contains `text` (or stops containing it). */
async function waitForText(page: Page, text: string, present = true, timeout = 6000): Promise<boolean> {
  return await page.waitForFunction(([value, wanted]) => document.body.innerText.includes(value as string) === wanted, [text, present] as const, { timeout })
    .then(() => true, () => false)
}

/** Navigates like the app's own links do, through the Vue Router instance of the Nuxt app. */
async function routerPush(page: Page, path: string, query: Record<string, string>): Promise<void> {
  await page.evaluate(([to, params]) => {
    const root = document.querySelector("#__nuxt") as (Element & { __vue_app__?: { config: { globalProperties: { $router: { push: (to: unknown) => Promise<unknown> } } } } }) | null
    const router = root?.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("No Vue Router on #__nuxt")
    return router.push({ path: to, query: params })
  }, [path, query] as const)
}

function nuxtDataBytes(html: string): number | undefined {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  return match ? Buffer.byteLength(match[1]!) : undefined
}

function metaContent(html: string, key: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
    const name = tag.match(/\b(?:property|name)="([^"]*)"/)?.[1]
    if (name === key) return tag.match(/\bcontent="([^"]*)"/)?.[1]
  }
  return undefined
}

const mutatingMethods = new Set(["POST", "PUT", "PATCH"])

interface RsvpScenario {
  failure?: string
  triggerFound: boolean
  formVisibleBefore: boolean
  dialogWithForm: boolean
  /** Writes the app sent after a submit with a bad email. */
  requestsAfterBadSubmit: number
  sent?: { url: string, method: string, contentType: string, body: string, email: string }
  sentStatus?: number
}

/** Opens the RSVP dialog, submits a bad email, then a good RSVP, and records what the app did. */
async function rsvpScenario(runtime: MeetupsRuntime): Promise<RsvpScenario> {
  const event = sampleEvent(0)
  const email = `probe.${Date.now()}@example.test`
  return await runtime.withPage({ locale: "en-US", timezoneId: "UTC" }, async (page, log) => {
    const result: RsvpScenario = { triggerFound: false, formVisibleBefore: false, dialogWithForm: false, requestsAfterBadSubmit: 0 }
    await page.goto(new URL(`/events/${event.slug}`, runtime.origin).href, { waitUntil: "networkidle" })
    const visibleEmail = () => page.locator("input[type=email], input[name*=email i], input[autocomplete=email]").or(page.getByLabel(/email/i)).filter({ visible: true })
    result.formVisibleBefore = await visibleEmail().count() > 0
    const trigger = page.getByRole("button", { name: /^\s*rsvp\b/i }).filter({ visible: true }).first()
    result.triggerFound = await trigger.count() > 0
    if (!result.triggerFound) return { ...result, failure: "No visible RSVP button." }
    await trigger.click()
    const dialog = page.getByRole("dialog").filter({ visible: true }).first()
    await dialog.waitFor({ state: "visible", timeout: 5000 }).catch(() => {})
    const scope = await dialog.count() > 0 ? dialog : page.locator("body")
    const field = (label: RegExp, fallback: string) => scope.getByLabel(label).or(scope.locator(fallback)).filter({ visible: true }).first()
    const emailInput = field(/email/i, "input[type=email], input[name*=email i]")
    result.dialogWithForm = await dialog.count() > 0 && await dialog.locator("input").filter({ visible: true }).count() > 0 && await emailInput.count() > 0
    if (await emailInput.count() === 0) return { ...result, failure: "No email field after clicking RSVP." }

    await field(/name/i, "input[name*=name i]").fill("Probe Person").catch(() => {})
    const seats = field(/seats?/i, "input[name*=seat i], select[name*=seat i]")
    if (await seats.count() > 0) {
      const tag = await seats.evaluate(element => element.tagName.toLowerCase())
      if (tag === "select") await seats.selectOption("2").catch(() => {})
      else if (tag === "input") await seats.fill("2").then(() => seats.press("Tab")).catch(() => {})
      else {
        await seats.click().catch(() => {})
        await page.getByRole("option", { name: /^2$/ }).first().click({ timeout: 2000 }).catch(() => {})
      }
    }
    const submit = scope.locator("button[type=submit], input[type=submit]").filter({ visible: true }).or(scope.getByRole("button", { name: /confirm|submit|send|reserve|book|rsvp/i }).filter({ visible: true })).last()

    await emailInput.fill("not-an-email")
    const before = log.appRequests.length
    await submit.click({ timeout: 3000 }).catch(() => emailInput.press("Enter"))
    await page.waitForTimeout(1200)
    result.requestsAfterBadSubmit = log.appRequests.slice(before).filter(request => mutatingMethods.has(request.method())).length

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(email)
      const sent = page.waitForRequest(request => mutatingMethods.has(request.method()) && (request.postData() ?? "").includes(email), { timeout: 6000 })
      await submit.click({ timeout: 3000 }).catch(() => emailInput.press("Enter"))
      const request = await sent.catch(() => undefined)
      if (request) {
        result.sent = { url: request.url(), method: request.method(), contentType: (await request.allHeaders())["content-type"] ?? "", body: request.postData() ?? "", email }
        result.sentStatus = (await request.response().catch(() => null))?.status()
      }
    }
    if (!result.sent) result.failure = "The form never sent a valid RSVP."
    return result
  })
}

/** The captured RSVP body with one field changed. */
function changedBody(sent: NonNullable<RsvpScenario["sent"]>, change: (body: Record<string, unknown>, emailKey: string) => void): string | undefined {
  if (sent.contentType.includes("json")) {
    const body = JSON.parse(sent.body) as Record<string, unknown>
    const emailKey = Object.keys(body).find(key => body[key] === sent.email)
    if (!emailKey) return undefined
    change(body, emailKey)
    return JSON.stringify(body)
  }
  if (sent.contentType.includes("x-www-form-urlencoded")) {
    const params = new URLSearchParams(sent.body)
    const body: Record<string, unknown> = Object.fromEntries(params)
    const emailKey = Object.keys(body).find(key => body[key] === sent.email)
    if (!emailKey) return undefined
    change(body, emailKey)
    return new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)])).toString()
  }
  return undefined
}

async function replay(runtime: MeetupsRuntime, sent: NonNullable<RsvpScenario["sent"]>, body: string) {
  return await runtime.request(sent.url, { method: sent.method, body, headers: { "content-type": sent.contentType, "accept": "application/json" } })
}

const codeFile = (file: TaskFile) => /\.(vue|ts|js|mjs|cts|mts|tsx|jsx)$/.test(file.path) && !/(^|\/)(test|tests|__tests__)\//.test(file.path) && !/\.(test|spec)\./.test(file.path)
const appCode = (file: TaskFile) => codeFile(file) && !/^nuxt\.config\./.test(file.path) && !file.path.startsWith("services/")

/** GET URLs for the server routes the agent added, with sample values for route params. */
function serverRouteUrls(files: TaskFile[], slug: string, id: number): string[] {
  const urls = new Set<string>()
  for (const file of files) {
    const match = file.path.match(/^server\/(api|routes)\/(.+)\.(?:ts|js|mjs)$/)
    if (!match) continue
    let route = match[2]!
    const method = route.match(/\.(get|post|put|patch|delete|head|options)$/)?.[1]
    if (method && method !== "get") continue
    route = route.replace(/\.(get|post|put|patch|delete|head|options)$/, "").replace(/(^|\/)index$/, "")
    const path = route.split("/").filter(Boolean).map(segment => segment.replace(/\[\[?(?:\.\.\.)?([^\]]+)\]\]?/g, (_, name: string) => /id$/i.test(name) ? String(id) : slug)).join("/")
    urls.add(`${match[1] === "api" ? "/api" : ""}/${path}`.replace(/\/$/, "") || "/")
  }
  return [...urls]
}

function hydrationProblems(log: PageLog): string[] {
  return [
    ...log.pageErrors.map(error => `page error: ${error.message}`),
    ...log.console.filter(message => message.type() === "error" || (message.type() === "warning" && /hydrat|mismatch/i.test(message.text())))
      .map(message => message.text())
      .filter(text => !/^Failed to load resource/.test(text)),
  ]
}


/** Picks `option` in the control labeled `label`: a native select, a Nuxt UI select (combobox), radios or buttons. */
async function choose(page: Page, label: RegExp, option: RegExp): Promise<boolean> {
  const control = page.getByRole("combobox", { name: label }).or(page.getByLabel(label)).filter({ visible: true }).first()
  if (await control.count() > 0) {
    const tag = await control.evaluate(element => element.tagName.toLowerCase())
    if (tag === "select") {
      const value = await control.evaluate((element, source) => [...(element as HTMLSelectElement).options].find(item => new RegExp(source, "i").test(`${item.label} ${item.value}`))?.value, option.source)
      if (!value) return false
      await control.selectOption(value)
      return true
    }
    await control.click()
    const item = page.getByRole("option", { name: option }).or(page.getByRole("menuitemradio", { name: option })).or(page.getByRole("menuitem", { name: option })).filter({ visible: true }).first()
    if (await item.count() === 0 && !await item.waitFor({ timeout: 2000 }).then(() => true, () => false)) return false
    await item.click()
    return true
  }
  const direct = page.getByRole("radio", { name: option }).or(page.getByRole("button", { name: option })).filter({ visible: true }).first()
  if (await direct.count() === 0) return false
  await direct.click()
  return true
}

/** The rendered sRGB color of a CSS color value (any syntax, oklch included). */
async function rgbOf(page: Page, color: string): Promise<[number, number, number]> {
  return await page.evaluate((value) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")!
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return [r!, g!, b!] as [number, number, number]
  }, color)
}

const near = (a: [number, number, number], b: [number, number, number], tolerance = 10) => a.every((value, index) => Math.abs(value - b[index]!) <= tolerance)

/** The seats left number shown on an event page, read from its text. */
async function shownSeats(page: Page): Promise<number | undefined> {
  const text = await page.evaluate(() => document.body.innerText)
  const match = text.match(/(\d+)\s*(?:seats?|spots?|places?)\s*(?:left|remaining|available)/i) ?? text.match(/(?:seats?|spots?|places?)\s*(?:left|remaining|available)\s*:?\s*(\d+)/i)
  return match ? Number(match[1]) : undefined
}

/** Every request the page makes that mentions `needle`: fetch, XHR, EventSource and WebSocket. Tracks which streams are still open. */
function watchTraffic(page: Page, needle: string) {
  const traffic = { requests: [] as { at: number, url: string, type: string }[], openStreams: new Set<string>() }
  page.on("request", (request) => {
    const url = request.url()
    if (!url.includes(needle) || !["fetch", "xhr", "eventsource"].includes(request.resourceType())) return
    traffic.requests.push({ at: Date.now(), url, type: request.resourceType() })
    if (request.resourceType() === "eventsource") {
      traffic.openStreams.add(url)
      const done = () => traffic.openStreams.delete(url)
      void request.response().then(response => response?.finished()).then(done, done)
    }
  })
  page.on("websocket", (socket) => {
    traffic.requests.push({ at: Date.now(), url: socket.url(), type: "websocket" })
    traffic.openStreams.add(socket.url())
    socket.on("close", () => traffic.openStreams.delete(socket.url()))
  })
  return traffic
}

interface SearchScenario {
  failure?: string
  requests: number
  shown: boolean
  url: string
}

/** Types a search the way a quick phone user does, one key every 80 ms, and never presses Enter. */
async function searchScenario(runtime: MeetupsRuntime): Promise<SearchScenario> {
  const term = "workshop"
  const expected = listPage({ q: term })
  const notExpected = listPage({}).find(event => !event.title.toLowerCase().includes(term))
  return await runtime.withPage({}, async (page, log) => {
    await page.goto(new URL("/events", runtime.origin).href, { waitUntil: "networkidle" })
    const box = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).or(page.getByLabel(/search/i)).filter({ visible: true }).first()
    if (await box.count() === 0) return { failure: "No search box on /events.", requests: 0, shown: false, url: page.url() }
    const before = log.appRequests.length
    await box.click()
    await box.pressSequentially(term, { delay: 80 })
    const shown = await waitForText(page, expected[0]!.title, true, 5000) && (!notExpected || await waitForText(page, notExpected.title, false, 3000))
    await page.waitForTimeout(1500)
    return { requests: log.appRequests.length - before, shown, url: page.url() }
  })
}

/** The href of the dashboard's Download CSV link for Ada's first event, opening an accordion item when needed. */
async function csvLink(runtime: MeetupsRuntime): Promise<{ href?: string, failure?: string }> {
  const origin = new URL(runtime.origin)
  return await runtime.withPage({}, async (page) => {
    await page.context().addCookies([{ name: "meetups_session", value: "ada", domain: origin.hostname, path: "/" }])
    await page.goto(new URL("/dashboard", runtime.origin).href, { waitUntil: "networkidle" })
    const link = () => page.locator("a").filter({ hasText: /csv/i }).first()
    if (await link().count() === 0) {
      const trigger = page.locator("main button[aria-expanded=false]").first()
      if (await trigger.count() > 0) await trigger.click()
      await page.waitForTimeout(800)
    }
    const href = await link().getAttribute("href").catch(() => null)
    return href ? { href: new URL(href, runtime.origin).pathname + new URL(href, runtime.origin).search } : { failure: "No link with \"CSV\" on the dashboard, also after opening an event." }
  })
}

const probes: MeetupsProbe[] = [
  {
    id: "build",
    title: "`nuxt build` passes",
    why: "Nothing else matters if the app can't ship.",
    layer: "gate",
    check: ({ runtime }) => runtime.failure?.startsWith("nuxt build failed") ? fail(runtime.failure.slice(0, 600)) : pass(),
  },
  {
    id: "pages-respond",
    title: "The server starts and /, /events, an event page and /login answer 200",
    why: "Pages that crash on the server (for example code that touches `window` during setup) never reach anyone.",
    layer: "gate",
    check: async ({ runtime }) => {
      if (!runtime.ready) return fail(runtime.failure ?? "The app did not start.")
      for (const path of ["/", "/events", `/events/${sampleEvent(0).slug}`, "/login"]) {
        const reply = await runtime.request(path)
        if (reply.status !== 200) return fail(`${path} answered ${reply.status}`)
      }
      return pass()
    },
  },

  // F1 Events list
  {
    id: "list-ssr",
    title: "A filtered list URL (search, city, page) has its results in the server HTML",
    why: "Shared links, search engines and slow phones get the right results without waiting for JavaScript.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const filter = { q: "meetup", city: "Lisbon" }
      const reply = await runtime.request(`/events?q=${filter.q}&city=${filter.city}&page=2`)
      const second = listPage({ ...filter, page: 2 })
      // An event can start while the probe runs and shift every page by one, so skip the edges.
      const first = listPage({ ...filter, page: 1 }).slice(1, -1)
      const found = second.filter(event => hasTitle(reply.text, event.title)).length
      const wrong = first.filter(event => hasTitle(reply.text, event.title)).length
      return found >= Math.ceil(second.length / 2) && wrong === 0
        ? pass(`${found}/${second.length} page 2 titles`)
        : fail(`${found}/${second.length} page 2 titles, ${wrong} page 1 titles (status ${reply.status})`)
    },
  },
  {
    id: "list-no-client-fetch",
    title: "Opening /events makes no API calls from the browser",
    why: "The server already fetched the data. Fetching again in the browser doubles the requests and can flash or mismatch the page.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({}, async (page, log) => {
      await page.goto(new URL("/events?city=Berlin", runtime.origin).href, { waitUntil: "networkidle" })
      await page.waitForTimeout(500)
      const calls = log.appRequests.map(request => `${request.method()} ${new URL(request.url()).pathname}`)
      return calls.length === 0 ? pass() : fail(`${calls.length} call(s): ${calls.slice(0, 3).join(", ")}`)
    }),
  },
  {
    id: "list-url-changes",
    title: "Each filter change makes at most one request, and Back and Forward show the earlier results",
    why: "Watchers that refetch next to reactive fetches send duplicate requests, and state that lives outside the URL breaks the browser's history.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({}, async (page, log) => {
      const lisbon = listPage({ city: "Lisbon" })[0]!.title
      const paris = listPage({ city: "Paris" })[0]!.title
      await page.goto(new URL("/events", runtime.origin).href, { waitUntil: "networkidle" })
      const counts: number[] = []
      for (const [city, title] of [["Lisbon", lisbon], ["Paris", paris]] as const) {
        const before = log.appRequests.length
        await routerPush(page, "/events", { city })
        if (!await waitForText(page, title)) return fail(`The list did not show ${city} results after the URL changed.`)
        await page.waitForTimeout(800)
        counts.push(log.appRequests.length - before)
      }
      await page.goBack()
      const back = await waitForText(page, lisbon) && await waitForText(page, paris, false)
      await page.goForward()
      const forward = await waitForText(page, paris) && await waitForText(page, lisbon, false)
      const detail = `requests per change: ${counts.join(", ")}; back ${back ? "ok" : "wrong"}, forward ${forward ? "ok" : "wrong"}`
      return counts.every(count => count <= 1) && back && forward ? pass(detail) : fail(detail)
    }).catch((error: Error) => fail(error.message.slice(0, 300))),
  },
  {
    id: "list-payload",
    title: "The /events page payload stays under 20 kB",
    why: "Sending full event records (descriptions, attendees, history) for 20 rows makes the page heavy on mobile data.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const bytes = nuxtDataBytes((await runtime.request("/events")).text)
      if (bytes === undefined) return fail("No __NUXT_DATA__ payload in the page.")
      return bytes <= 20_000 ? pass(`${bytes} bytes`) : fail(`${bytes} bytes`)
    },
  },

  // F2 Event page
  {
    id: "event-meta",
    title: "The event page has its title, og:title and a description in the server HTML",
    why: "Chat apps and social sites read link previews from the HTML and don't run JavaScript.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const event = sampleEvent(0)
      const html = (await runtime.request(`/events/${event.slug}`)).text
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""
      const ogTitle = metaContent(html, "og:title") ?? ""
      const description = metaContent(html, "og:description") ?? metaContent(html, "description") ?? ""
      const missing = [
        !title.includes(event.title) && "<title>",
        !ogTitle.includes(event.title) && "og:title",
        description.length < 20 && "description",
      ].filter(Boolean)
      return missing.length === 0 ? pass() : fail(`missing ${missing.join(", ")}`)
    },
  },
  {
    id: "event-404",
    title: "An unknown event answers with status 404",
    why: "A \"not found\" text on a 200 page gets indexed by search engines as a real page.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const reply = await runtime.request("/events/no-such-event-at-all")
      return reply.status === 404 ? pass() : fail(`status ${reply.status}`)
    },
  },

  // F3 Start times
  {
    id: "no-hydration-errors",
    title: "No hydration mismatch or console error when the browser is in another time zone than the server",
    why: "Dates formatted during render differ between a UTC server and a visitor in Auckland, and the mismatch breaks or flashes the page.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({ timezoneId: "Pacific/Auckland", locale: "en-GB" }, async (page, log) => {
      for (const path of ["/events", `/events/${sampleEvent(0).slug}`]) {
        await page.goto(new URL(path, runtime.origin).href, { waitUntil: "networkidle" })
        await page.waitForTimeout(500)
      }
      const problems = hydrationProblems(log)
      return problems.length === 0 ? pass() : fail(problems.slice(0, 2).join(" | ").slice(0, 400))
    }),
  },

  // F4 RSVP
  {
    id: "rsvp-dialog",
    title: "The RSVP button opens a dialog that holds the form, and the form is hidden before",
    why: "Nuxt UI modals take the trigger in the default slot and the content in `#body` or `#content`. Content in the wrong slot renders on the page instead of in the dialog.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const scenario = await runtime.once("rsvp", () => rsvpScenario(runtime))
      if (!scenario.triggerFound) return fail("No RSVP button.")
      if (scenario.formVisibleBefore) return fail("The email field is visible before the dialog opens.")
      return scenario.dialogWithForm ? pass() : fail(scenario.failure ?? "No dialog with the form after clicking RSVP.")
    },
  },
  {
    id: "rsvp-client-check",
    title: "The form blocks a bad email in the browser without a request, and still sends a good RSVP",
    why: "Visitors see the problem at the field right away, and the server isn't asked to reject what the page already knew was wrong.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const scenario = await runtime.once("rsvp", () => rsvpScenario(runtime))
      if (!scenario.sent) return fail(scenario.failure ?? "No RSVP was sent.")
      return scenario.requestsAfterBadSubmit === 0 ? pass() : fail(`${scenario.requestsAfterBadSubmit} request(s) after submitting a bad email`)
    },
  },
  {
    id: "rsvp-server-400",
    title: "The server answers 400 or 422 naming the field for a bad email and for 9 seats",
    why: "Anyone can call the API without the form. The server must check the same rules and say which field is wrong.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const scenario = await runtime.once("rsvp", () => rsvpScenario(runtime))
      const sent = scenario.sent
      if (!sent) return fail(scenario.failure ?? "No RSVP was sent, so there is no request to replay.")
      const badEmail = changedBody(sent, (body, key) => { body[key] = "not-an-email" })
      const tooMany = changedBody(sent, (body, key) => {
        body[key] = `probe.seats.${Date.now()}@example.test`
        const seatsKey = Object.keys(body).find(name => /seat/i.test(name))
        if (seatsKey) body[seatsKey] = typeof body[seatsKey] === "number" ? 9 : "9"
      })
      if (!badEmail || !tooMany) return fail(`Can't replay a ${sent.contentType || "plain"} body.`)
      const email = await replay(runtime, sent, badEmail)
      const seats = await replay(runtime, sent, tooMany)
      const detail = `bad email: ${email.status}, 9 seats: ${seats.status}`
      const named = /email/i.test(email.text) && /seat/i.test(seats.text)
      const rejected = (status: number) => status === 400 || status === 422
      return rejected(email.status) && rejected(seats.status) && named ? pass(detail) : fail(`${detail}${named ? "" : ", field not named"}`)
    },
  },
  {
    id: "rsvp-rules-once",
    title: "The 1 to 4 seats rule is written in one place",
    why: "The prompt says the rules will change. Rules copied into the form and the server drift apart on the next change.",
    layer: "static",
    check: ({ changed }) => {
      const rule = /\.max\(\s*4\b|maxValue\(\s*4\b|\.lte\(\s*4\b|max:\s*4\b|(?:<=|>)\s*4\b|\b4\s*(?:>=|<)/
      const places = changed.filter(appCode).filter(file => file.content.split("\n").some(line => /seat/i.test(line) && rule.test(line))).map(file => file.path)
      return places.length <= 1 ? pass(places[0]) : fail(places.join(", "))
    },
  },
  {
    id: "rsvp-fast-mail",
    title: "An RSVP answers in under 700 ms and sends exactly one email",
    why: "The mail provider takes 1.5 s. Waiting for it makes every RSVP slow, and retries or double handlers send duplicates.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const scenario = await runtime.once("rsvp", () => rsvpScenario(runtime))
      const sent = scenario.sent
      if (!sent) return fail(scenario.failure ?? "No RSVP was sent.")
      const email = `probe.mail.${Date.now()}@example.test`
      const body = changedBody(sent, (fields, key) => { fields[key] = email })
      if (!body) return fail(`Can't replay a ${sent.contentType || "plain"} body.`)
      const reply = await replay(runtime, sent, body)
      await new Promise(resolve => setTimeout(resolve, 3000))
      const mails = runtime.services.mails.filter(mail => JSON.stringify(mail).includes(email)).length
      const formMails = runtime.services.mails.filter(mail => JSON.stringify(mail).includes(sent.email)).length
      const detail = `status ${reply.status} in ${Math.round(reply.ms)} ms, ${mails} mail(s); form RSVP ${formMails} mail(s)`
      return reply.status < 300 && reply.ms < 700 && mails === 1 && formMails === 1 ? pass(detail) : fail(detail)
    },
  },

  // F5 Prices
  {
    id: "price-ssr",
    title: "US and UK visitors get dollar and pound prices in the server HTML",
    why: "The currency comes from the request, so the server can render it. Reading it in the browser shows euros first and then changes.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const slug = sampleEvent(0).slug
      const us = (await runtime.request(`/events/${slug}`, { language: "en-US,en;q=0.9" })).text
      const uk = (await runtime.request(`/events/${slug}`, { language: "en-GB,en;q=0.9" })).text
      const dollars = /(\$|US\$|USD)\s?21\.60|21\.60\s?(\$|USD)/.test(us)
      const pounds = /(£|GBP)\s?17\.20|17\.20\s?(£|GBP)/.test(uk)
      return dollars && pounds ? pass() : fail(`${dollars ? "" : "no $21.60 for en-US "}${pounds ? "" : "no £17.20 for en-GB"}`.trim())
    },
  },
  {
    id: "price-cached",
    title: "50 page views call the paid rates API at most twice",
    why: "The provider bills every request and rates change hourly, so the server should share one copy instead of paying per visitor.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const before = runtime.services.counts.rates
      const slugs = [0, 1, 2, 3, 4].map(index => sampleEvent(index).slug)
      const languages = ["en-US", "en-GB"]
      await runtime.request(`/events/${slugs[0]}`, { language: "en-US" })
      for (let batch = 0; batch < 7; batch++) {
        await Promise.all(Array.from({ length: 7 }, (_, index) => runtime.request(`/events/${slugs[(batch + index) % slugs.length]}`, { language: languages[index % 2] })))
      }
      const hits = runtime.services.counts.rates - before
      return hits <= 2 ? pass(`${hits} upstream call(s)`) : fail(`${hits} upstream calls`)
    },
  },
  {
    id: "price-key-private",
    title: "The rates API key is not in any HTML, payload or browser asset",
    why: "A key in client code or public config is readable by every visitor.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const pages = await Promise.all(["/events", `/events/${sampleEvent(0).slug}`, "/dashboard"].map(path => runtime.request(path, { user: "ada", language: "en-US" })))
      const assets = await publicAssets(runtime.dir)
      const texts = [...pages.map((page, index) => ({ path: `page ${index}`, text: page.text })), ...assets]
      const leak = texts.find(entry => entry.text.includes(runtime.keys.run) || entry.text.includes(runtime.keys.build))
      return leak ? fail(`key found in ${leak.path.replace(runtime.dir, "")}`) : pass()
    },
  },
  {
    id: "price-runtime-config",
    title: "App and server code read settings from runtime config, not `process.env`",
    why: "`process.env` in app code is undefined in the browser and on some hosts, and it skips the runtime config that ops override per deploy.",
    layer: "static",
    check: ({ changed }) => {
      const files = changed.filter(appCode).filter(file => /\bprocess\.env\b(?!\.NODE_ENV)/.test(file.content)).map(file => file.path)
      return files.length === 0 ? pass() : fail(files.join(", "))
    },
  },

  // F6 Dashboard
  {
    id: "dashboard-guard",
    title: "The server redirects anonymous visitors from /dashboard to sign-in and refuses members",
    why: "A guard that runs only in the browser still sends the page, and a flash of it, to people who may not see it.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const anonymous = await runtime.request("/dashboard")
      const member = await runtime.request("/dashboard", { user: "linus" })
      const redirected = anonymous.status >= 300 && anonymous.status < 400 && /\/login\b/.test(anonymous.headers.get("location") ?? "")
      const refused = member.status === 403 || (member.status >= 300 && member.status < 400 && !/\/dashboard/.test(member.headers.get("location") ?? ""))
      const detail = `anonymous ${anonymous.status} ${anonymous.headers.get("location") ?? ""}, member ${member.status}`.trim()
      return redirected && refused ? pass(detail) : fail(detail)
    },
  },
  {
    id: "dashboard-ssr",
    title: "An organizer's /dashboard has their own next events in the server HTML, and not another organizer's",
    why: "Server-side fetches must carry the visitor's cookie. Without it the server sees an anonymous request and renders nothing or an error.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const now = Date.now()
      const next = (organizer: string) => listEvents().find(event => event.organizerId === organizer && Date.parse(event.startsAt) > now + 60 * 60 * 1000)!
      const reply = await runtime.request("/dashboard", { user: "ada" })
      const own = hasTitle(reply.text, next("ada").title)
      const other = hasTitle(reply.text, next("grace").title)
      return reply.status === 200 && own && !other ? pass() : fail(`status ${reply.status}, own event ${own ? "shown" : "missing"}, other organizer's event ${other ? "shown" : "hidden"}`)
    },
  },
  {
    id: "attendees-private",
    title: "No page or API response shows attendee emails to anonymous visitors or members",
    why: "Returning whole event records leaks every attendee's email in JSON and page payloads, even when the page doesn't display them.",
    layer: "runtime",
    check: async ({ runtime, files }) => {
      const event = sampleEvent(1)
      const paths = ["/events", "/events?page=2", `/events/${event.slug}`, "/dashboard", ...serverRouteUrls(files, event.slug, event.id)]
      for (const path of paths) {
        for (const user of [undefined, "linus"] as const) {
          const reply = await runtime.request(path, { ...(user ? { user } : {}), headers: { accept: path.startsWith("/api/") ? "application/json" : "text/html" } })
          if (reply.text.includes("@attendee.test")) return fail(`${path} as ${user ?? "anonymous"} (status ${reply.status})`)
        }
      }
      return pass(`${paths.length} URLs`)
    },
  },
  // F1 Search as you type
  {
    id: "search-live",
    title: "Typing in the search box updates the results and the URL without pressing Enter",
    why: "Visitors expect results to follow what they type, and a shared link must open the same search.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const scenario = await runtime.once("search", () => searchScenario(runtime))
      if (scenario.failure) return fail(scenario.failure)
      const inUrl = new URL(scenario.url).searchParams.get("q")?.toLowerCase() === "workshop"
      return scenario.shown && inUrl ? pass() : fail(`${scenario.shown ? "results updated" : "results did not update"}, URL ${inUrl ? "has" : "lacks"} the search`)
    },
  },
  {
    id: "search-debounced",
    title: "Typing an 8-letter search sends at most 2 requests",
    why: "A request per key press costs phones on slow mobile data, and the answers can arrive out of order.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const scenario = await runtime.once("search", () => searchScenario(runtime))
      if (scenario.failure) return fail(scenario.failure)
      if (!scenario.shown) return fail(`The results did not follow the search (${scenario.requests} requests).`)
      return scenario.requests <= 2 ? pass(`${scenario.requests} request(s)`) : fail(`${scenario.requests} requests`)
    },
  },

  // F7 Header
  {
    id: "header-user-per-request",
    title: "40 parallel page views by different people each show only their own name",
    why: "State kept in a module-level `ref` lives on the server for every visitor at once, so one person's name (or data) shows up in another person's page.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const names = { ada: "Ada Lovelace", grace: "Grace Hopper", linus: "Linus Park" } as const
      // The dashboard reads the session again after the header did, so requests interleave on the server.
      const views = [
        ...Array.from({ length: 20 }, (_, index) => ({ path: "/dashboard", user: index % 2 ? "grace" as const : "ada" as const })),
        ...Array.from({ length: 20 }, (_, index) => ({ path: "/events", user: ([undefined, "ada", "linus", "grace"] as const)[index % 4] })),
      ]
      const replies = await Promise.all(views.map(view => runtime.request(view.path, view.user ? { user: view.user } : {})))
      const wrong: string[] = []
      replies.forEach((reply, index) => {
        const { path, user } = views[index]!
        const others = Object.entries(names).filter(([id]) => id !== user).map(([, name]) => name).filter(name => reply.text.includes(name))
        const own = user ? reply.text.includes(names[user]) : /sign in/i.test(reply.text)
        if (!own || others.length) wrong.push(`${path} as ${user ?? "anonymous"}: ${own ? "" : "own name missing "}${others.length ? `shows ${others.join(", ")}` : ""}`.trim())
      })
      return wrong.length === 0 ? pass(`${views.length} pages`) : fail(`${wrong.length}/${views.length} wrong: ${[...new Set(wrong)].slice(0, 3).join("; ")}`)
    },
  },

  // F8 Currency picker
  {
    id: "currency-choice-remembered",
    title: "After choosing GBP, a US visitor's next page has pound prices in the server HTML",
    why: "A choice kept in localStorage is invisible to the server, so every visit starts in the wrong currency and then flips.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({ locale: "en-US", extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" } }, async (page) => {
      const event = sampleEvent(5)
      await page.goto(new URL(`/events/${event.slug}`, runtime.origin).href, { waitUntil: "networkidle" })
      if (!await choose(page, /currency/i, /GBP|£|pound/i)) return fail("No Currency picker with GBP.")
      const switched = await waitForText(page, "£17.20", true, 5000) || await waitForText(page, "17.20", true, 1000)
      const html = await (await page.context().request.get(new URL(`/events/${event.slug}`, runtime.origin).href, { headers: { "accept-language": "en-US,en;q=0.9", "accept": "text/html" } })).text()
      const pounds = /(£|GBP)\s?17\.20|17\.20\s?(£|GBP)/.test(html)
      return pounds ? pass(switched ? undefined : "the open page did not switch") : fail(`server HTML has ${/\$\s?21\.60/.test(html) ? "dollars" : "no pound price"}${switched ? "" : "; the open page did not switch either"}`)
    }).catch((error: Error) => fail(error.message.slice(0, 300))),
  },

  // F9 Live seats
  {
    id: "seats-live",
    title: "An open event page shows the new seats left within 8 seconds after someone else RSVPs",
    why: "The prompt asks for live seats; visitors decide on the number they see.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const scenario = await runtime.once("rsvp", () => rsvpScenario(runtime))
      const sent = scenario.sent
      if (!sent) return fail(scenario.failure ?? "No RSVP was sent, so there is no request to replay.")
      const from = sampleEvent(0)
      const event = sampleEvent(2)
      const url = sent.url.replace(from.slug, event.slug).replace(new RegExp(`/${from.id}(?=/|$|\\?)`), `/${event.id}`)
      if (url === sent.url) return fail("Can't tell which event the RSVP URL names.")
      const body = changedBody(sent, (fields, key) => {
        fields[key] = `probe.live.${Date.now()}@example.test`
        const seatsKey = Object.keys(fields).find(name => /seat/i.test(name))
        if (seatsKey) fields[seatsKey] = typeof fields[seatsKey] === "number" ? 3 : "3"
      })
      if (!body) return fail(`Can't replay a ${sent.contentType || "plain"} body.`)
      return await runtime.withPage({}, async (page) => {
        await page.goto(new URL(`/events/${event.slug}`, runtime.origin).href, { waitUntil: "networkidle" })
        const before = await shownSeats(page)
        if (before === undefined) return fail("No seats left number on the event page.")
        const reply = await runtime.request(url, { method: sent.method, body, headers: { "content-type": sent.contentType, "accept": "application/json" } })
        if (reply.status >= 300) return fail(`The replayed RSVP answered ${reply.status}.`)
        const deadline = Date.now() + 8000
        while (Date.now() < deadline) {
          if (await shownSeats(page) === before - 3) return pass(`${before} → ${before - 3}`)
          await page.waitForTimeout(250)
        }
        return fail(`still ${await shownSeats(page)} seats after 8 s (expected ${before - 3})`)
      })
    },
  },
  {
    id: "seats-stop-on-leave",
    title: "After leaving an event page in the app, it stops checking the seats",
    why: "A timer or stream that outlives its page keeps sending paid requests for a page nobody looks at.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({}, async (page) => {
      const event = sampleEvent(3)
      const traffic = watchTraffic(page, event.slug)
      await page.goto(new URL(`/events/${event.slug}`, runtime.origin).href, { waitUntil: "networkidle" })
      await page.waitForTimeout(6000)
      const live = traffic.requests.length > 0 || traffic.openStreams.size > 0
      if (!live) return fail("The event page made no live seat checks within 6 s.")
      await routerPush(page, "/events", {})
      await page.waitForTimeout(2000)
      const after = traffic.requests.length
      await page.waitForTimeout(8000)
      const extra = traffic.requests.length - after
      const open = traffic.openStreams.size
      return extra === 0 && open === 0 ? pass() : fail(`${extra} request(s) in 8 s after leaving${open ? `, ${open} stream(s) still open` : ""}`)
    }).catch((error: Error) => fail(error.message.slice(0, 300))),
  },
  {
    id: "seats-pause-hidden",
    title: "While the tab is hidden, the event page stops checking the seats",
    why: "Background tabs stay open for hours. Checking while nobody looks costs a request every few seconds per tab.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({}, async (page) => {
      const event = sampleEvent(4)
      const traffic = watchTraffic(page, event.slug)
      await page.goto(new URL(`/events/${event.slug}`, runtime.origin).href, { waitUntil: "networkidle" })
      await page.waitForTimeout(6000)
      if (traffic.requests.length === 0 && traffic.openStreams.size === 0) return fail("The event page made no live seat checks within 6 s.")
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true })
        document.dispatchEvent(new Event("visibilitychange"))
        window.dispatchEvent(new Event("blur"))
      })
      await page.waitForTimeout(2000)
      const after = traffic.requests.length
      await page.waitForTimeout(8000)
      const extra = traffic.requests.length - after
      const open = traffic.openStreams.size
      return extra === 0 && open === 0 ? pass() : fail(`${extra} request(s) in 8 s while hidden${open ? `, ${open} stream(s) still open` : ""}`)
    }).catch((error: Error) => fail(error.message.slice(0, 300))),
  },

  // F10 Brand and dark mode
  {
    id: "brand-color",
    title: "The primary color is #00DC82 everywhere, also on the existing home page button",
    why: "Brand colors belong in the theme. Classes on single components miss every page and component nobody touched.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({ colorScheme: "light" }, async (page) => {
      await page.goto(new URL("/", runtime.origin).href, { waitUntil: "networkidle" })
      const button = page.getByRole("link", { name: /browse events/i }).or(page.getByRole("button", { name: /browse events/i })).first()
      const buttonColor = await button.count() ? await rgbOf(page, await button.evaluate(element => getComputedStyle(element).backgroundColor)) : undefined
      const tokenColor = await rgbOf(page, await page.evaluate(() => {
        const probe = document.createElement("span")
        probe.className = "text-primary"
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      }))
      const brand: [number, number, number] = [0, 220, 130]
      const ok = near(tokenColor, brand) && (!buttonColor || near(buttonColor, brand))
      const detail = `primary token rgb(${tokenColor.join(",")})${buttonColor ? `, home button rgb(${buttonColor.join(",")})` : ", no home button"}`
      return ok ? pass(detail) : fail(detail)
    }),
  },
  {
    id: "brand-corners",
    title: "Buttons, inputs and selects have 2 px corners, also on pages that existed before",
    why: "A radius set per component leaves the other controls with the old corners. Nuxt UI themes it in one place.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({}, async (page) => {
      const radii: string[] = []
      const bad: string[] = []
      for (const [path, selector] of [["/", "main a, main button"], ["/login", "main button"], ["/events", "main input"], ["/events", "main button[role=combobox], main select"]] as const) {
        await page.goto(new URL(path, runtime.origin).href, { waitUntil: "networkidle" })
        const element = page.locator(selector).filter({ visible: true }).first()
        if (await element.count() === 0) continue
        const radius = await element.evaluate(node => Number.parseFloat(getComputedStyle(node).borderTopLeftRadius))
        radii.push(`${path} ${selector.split(",")[0]!.replace("main ", "")} ${radius}px`)
        if (radius < 1 || radius > 3) bad.push(`${path} ${radius}px`)
      }
      if (radii.length < 3) return fail(`Found only ${radii.length} controls to measure.`)
      return bad.length === 0 ? pass(radii.join(", ")) : fail(radii.join(", "))
    }),
  },
  {
    id: "dark-no-flash",
    title: "A visitor who chose dark gets a dark page before any app JavaScript runs",
    why: "A theme applied after the app boots flashes the light page on every visit. Nuxt UI's color mode sets it before the first paint.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({ colorScheme: "light" }, async (page) => {
      await page.goto(new URL("/events", runtime.origin).href, { waitUntil: "networkidle" })
      const toggle = page.getByRole("button", { name: /dark|theme|color mode|colour mode/i }).or(page.getByRole("switch", { name: /dark|theme|mode/i })).filter({ visible: true }).first()
      if (await toggle.count() === 0) return fail("No light/dark switch.")
      await toggle.click()
      const option = page.getByRole("menuitemradio", { name: /dark/i }).or(page.getByRole("option", { name: /dark/i })).or(page.getByRole("menuitem", { name: /dark/i })).filter({ visible: true }).first()
      if (await option.count() > 0) await option.click()
      const darkNow = await page.waitForFunction(() => {
        const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)!.map(Number)
        return document.documentElement.classList.contains("dark") || (r! + g! + b!) / 3 < 80
      }, undefined, { timeout: 3000 }).then(() => true, () => false)
      if (!darkNow) return fail("The switch did not turn the page dark.")
      await page.waitForTimeout(500)
      // Reload with every app script blocked: only the HTML, its inline scripts and the CSS run.
      await page.route(/\/_nuxt\/.*\.m?js(\?|$)/, route => route.abort())
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForTimeout(500)
      const dark = await page.evaluate(() => document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark")
      return dark ? pass() : fail("The reloaded page is light until the app's JavaScript runs.")
    }).catch((error: Error) => fail(error.message.slice(0, 300))),
  },

  // F11 Old links
  {
    id: "old-links-permanent",
    title: "/e/<id> answers 301 or 308 to the event page, and an unknown id answers 404",
    why: "Only a permanent redirect makes search engines move the old link's ranking to the new address. A 302 or a client-side jump doesn't.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const event = sampleEvent(6)
      const reply = await runtime.request(`/e/${event.id}`)
      const location = reply.headers.get("location") ?? ""
      const missing = await runtime.request("/e/9999999")
      const moved = (reply.status === 301 || reply.status === 308) && new URL(location, runtime.origin).pathname === `/events/${event.slug}`
      const detail = `/e/${event.id}: ${reply.status} ${location}; unknown: ${missing.status}`
      return moved && missing.status === 404 ? pass(detail) : fail(detail)
    },
  },

  // F12 Attendee export
  {
    id: "csv-download",
    title: "The dashboard's Download CSV link gives the organizer `attendees-<slug>.csv` with the attendees",
    why: "Organizers open the file in a spreadsheet. It needs the CSV type, the file name, and every attendee.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const link = await runtime.once("csv-link", () => csvLink(runtime))
      if (!link.href) return fail(link.failure ?? "No Download CSV link.")
      const reply = await runtime.request(link.href, { user: "ada", headers: { accept: "text/csv,*/*" } })
      const type = reply.headers.get("content-type") ?? ""
      const disposition = reply.headers.get("content-disposition") ?? ""
      const event = listEvents().find(item => link.href!.includes(item.slug))
      const named = event ? disposition.includes(`attendees-${event.slug}.csv`) : false
      const emails = event ? event.attendees.slice(0, 3).every(attendee => reply.text.includes(attendee.email)) : false
      const detail = `status ${reply.status}, ${type || "no type"}, ${disposition || "no file name"}`
      return reply.status === 200 && /text\/csv/.test(type) && /attachment/i.test(disposition) && named && emails ? pass(detail) : fail(`${detail}${emails ? "" : ", attendees missing"}`)
    },
  },
  {
    id: "csv-owner-only",
    title: "The CSV URL refuses anonymous visitors, members and other organizers",
    why: "Hiding a link is not a guard. The file has every attendee's email, and anyone can call its URL.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const link = await runtime.once("csv-link", () => csvLink(runtime))
      if (!link.href) return fail(link.failure ?? "No Download CSV link.")
      const leaks: string[] = []
      for (const user of [undefined, "linus", "grace"] as const) {
        const reply = await runtime.request(link.href, { ...(user ? { user } : {}), headers: { accept: "text/csv,*/*" } })
        if (reply.status < 300 || reply.text.includes("@attendee.test")) leaks.push(`${user ?? "anonymous"} ${reply.status}`)
      }
      return leaks.length === 0 ? pass() : fail(`served to ${leaks.join(", ")}`)
    },
  },
  // v2 extras
  {
    id: "list-back-instant",
    title: "Back from an event page shows the filtered list again without a request",
    why: "On slow mobile data, the list the visitor just saw should come back at once, not after another round trip.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({}, async (page, log) => {
      const first = listPage({ city: "Berlin" })[0]!
      await page.goto(new URL("/events?city=Berlin", runtime.origin).href, { waitUntil: "networkidle" })
      await page.locator(`main a[href$="/events/${first.slug}"]`).first().click()
      await page.waitForURL(url => url.pathname === `/events/${first.slug}`, { timeout: 8000 })
      await page.waitForTimeout(1000)
      const before = log.appRequests.length
      await page.goBack()
      if (!await waitForText(page, first.title, true, 4000)) return fail("The list did not come back.")
      await page.waitForTimeout(1000)
      const calls = log.appRequests.slice(before).map(request => new URL(request.url())).filter(url => !url.pathname.includes(first.slug)).map(url => url.pathname + url.search)
      return calls.length === 0 ? pass() : fail(`${calls.length} request(s): ${calls.slice(0, 2).join(", ")}`)
    }).catch((error: Error) => fail(error.message.slice(0, 300))),
  },
  {
    id: "not-found-page",
    title: "Unknown events and unknown addresses get a 404 page with the site header and a link to /events",
    why: "A bare error screen is a dead end. Nuxt renders `error.vue` outside the layout unless it asks for one.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const problems: string[] = []
      for (const path of ["/events/no-such-event-at-all", "/no-such-page"]) {
        const reply = await runtime.request(path)
        const header = /href="\/dashboard"/.test(reply.text)
        const back = /href="\/events"/.test(reply.text)
        if (reply.status !== 404 || !header || !back) problems.push(`${path}: ${reply.status}${header ? "" : ", no header"}${back ? "" : ", no link to /events"}`)
      }
      return problems.length === 0 ? pass() : fail(problems.join("; "))
    },
  },
  {
    id: "event-canonical",
    title: "An event page opened with tracking parameters names its clean address as canonical",
    why: "Links shared with `?utm_source=` would otherwise count as separate pages for search engines.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const event = sampleEvent(0)
      const html = (await runtime.request(`/events/${event.slug}?utm_source=newsletter&utm_medium=email`)).text
      const tag = html.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0]
      const href = tag?.match(/href="([^"]*)"/)?.[1]
      if (!href) return fail("No canonical link.")
      const url = new URL(href.replaceAll("&amp;", "&"), runtime.origin)
      return url.pathname === `/events/${event.slug}` && !url.search ? pass(href) : fail(href)
    },
  },
  {
    id: "rsvp-once",
    title: "A double click on the form's submit button books once",
    why: "Impatient visitors click twice on slow connections. Two requests book twice the seats and send two emails.",
    layer: "runtime",
    check: async ({ runtime }) => await runtime.withPage({}, async (page) => {
      const event = sampleEvent(7)
      const email = `probe.double.${Date.now()}@example.test`
      await page.goto(new URL(`/events/${event.slug}`, runtime.origin).href, { waitUntil: "networkidle" })
      const trigger = page.getByRole("button", { name: /^\s*rsvp\b/i }).filter({ visible: true }).first()
      if (await trigger.count() === 0) return fail("No RSVP button.")
      await trigger.click()
      const dialog = page.getByRole("dialog").filter({ visible: true }).first()
      await dialog.waitFor({ state: "visible", timeout: 5000 }).catch(() => {})
      const scope = await dialog.count() > 0 ? dialog : page.locator("body")
      const field = (label: RegExp, fallback: string) => scope.getByLabel(label).or(scope.locator(fallback)).filter({ visible: true }).first()
      await field(/name/i, "input[name*=name i]").fill("Double Clicker").catch(() => {})
      const emailInput = field(/email/i, "input[type=email], input[name*=email i]")
      if (await emailInput.count() === 0) return fail("No email field.")
      await emailInput.fill(email)
      const posts: string[] = []
      page.on("request", (request) => { if (mutatingMethods.has(request.method()) && (request.postData() ?? "").includes(email)) posts.push(request.url()) })
      const submit = scope.locator("button[type=submit], input[type=submit]").filter({ visible: true }).or(scope.getByRole("button", { name: /confirm|submit|send|reserve|book|rsvp/i }).filter({ visible: true })).last()
      await submit.dblclick({ timeout: 3000 })
      await page.waitForTimeout(2500)
      const mails = runtime.services.mails.filter(mail => JSON.stringify(mail).includes(email)).length
      return posts.length === 1 ? pass(`1 request, ${mails} mail(s)`) : fail(`${posts.length} requests`)
    }).catch((error: Error) => fail(error.message.slice(0, 300))),
  },
  {
    id: "chart-split",
    title: "The chart library is not in the code /events loads up front",
    why: "Chart code registered globally ships to every page, so the most visited page pays for a chart only organizers see.",
    layer: "runtime",
    check: async ({ runtime }) => {
      const marker = "Canvas is already in use"
      const assets = new Map((await publicAssets(runtime.dir)).map(asset => [asset.path.slice(join(runtime.dir, ".output/public").length), asset.text]))
      if (![...assets.values()].some(text => text.includes(marker))) return pass("chart.js is not in the build")
      // What /events needs before it runs: the scripts and module preloads in its HTML, and everything they import
      // statically. Chunks that NuxtLink prefetches later for other routes don't count.
      const html = (await runtime.request("/events")).text
      const queue = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+\.m?js)"[^>]*>/g)]
        .filter(match => /<script\b/.test(match[0]) || /rel="modulepreload"/.test(match[0]))
        .map(match => new URL(match[1]!, runtime.origin).pathname)
      const seen = new Set<string>()
      while (queue.length) {
        const path = queue.shift()!
        if (seen.has(path)) continue
        seen.add(path)
        const text = assets.get(path) ?? ""
        if (text.includes(marker)) return fail(`${path} has chart.js`)
        for (const match of text.matchAll(/\b(?:import|export)\s*(?:[^"'();]*?\bfrom\s*)?["']([^"']+\.m?js)["']/g)) queue.push(new URL(match[1]!, new URL(path, runtime.origin)).pathname)
      }
      return pass(`${seen.size} scripts checked`)
    },
  },
]

const task: Task<MeetupsRuntime> = {
  id: "meetups",
  title: "Meetups: list, event page, RSVP, prices, dashboard",
  // Runtime probes need the running app. When it didn't start, they fail with the gate's reason.
  probes: probes.map(probe => probe.layer !== "runtime" ? probe : {
    ...probe,
    check: input => input.runtime.ready ? probe.check(input) : fail(`The app did not start. ${input.runtime.failure ?? ""}`.slice(0, 300)),
  }),
  start: startMeetups,
}

export default task
