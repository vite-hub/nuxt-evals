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
    title: "The server answers 400 naming the field for a bad email and for 9 seats",
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
      return email.status === 400 && seats.status === 400 && named ? pass(detail) : fail(`${detail}${named ? "" : ", field not named"}`)
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
