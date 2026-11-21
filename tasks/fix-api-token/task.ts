import type { Browser } from "playwright-core"
import { fail, pass } from "../meetups/checks.ts"
import type { Task } from "../types.ts"

/**
 * Notebook: a small Nuxt 5 app over an API that only takes `Authorization: Bearer <token>`. The token is in a cookie and
 * no request sends it, so every page fails after sign-in. The common wrong fix is a plugin that reassigns
 * `globalThis.$fetch` to a `$fetch.create()` instance: neither `useFetch` nor `$fetch` uses it, on the server or in the
 * browser (checked on this Nuxt nightly, 2026-11-15). From github.com/Charles5277/nuxt-agent-pitfalls, check 2c.
 */

const users = {
  ada: { email: "ada@example.test", notes: ["Engine notes", "Bernoulli numbers"], noteId: "n-ada-1", body: "The engine weaves algebraic patterns." },
  alan: { email: "alan@example.test", notes: ["Imitation game"], noteId: "n-alan-1", body: "Can machines think?" },
}

async function signIn(origin: string, email: string): Promise<string> {
  const response = await fetch(new URL("/api/login", origin), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "notebook" }) })
  if (!response.ok) throw new Error(`POST /api/login answered ${response.status}; the API changed.`)
  return (await response.json() as { token: string }).token
}

/** Server-rendered HTML of `path` for a visitor whose `token` cookie is `token`. */
async function render(origin: string, path: string, token?: string) {
  const response = await fetch(new URL(path, origin), { headers: { accept: "text/html", ...(token ? { cookie: `token=${token}` } : {}) }, redirect: "manual" })
  return { status: response.status, location: response.headers.get("location"), html: await response.text() }
}

/** Signs in through the form, opens a note by clicking, goes back and adds a note. Records every /api request's Authorization header. */
async function browse(browser: Browser, origin: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const requests: { path: string, auth: string | null }[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin === new URL(origin).origin && url.pathname.startsWith("/api/") && url.pathname !== "/api/login") requests.push({ path: `${request.method()} ${url.pathname}`, auth: request.headers().authorization ?? null })
  })
  const steps: string[] = []
  try {
    await page.goto(new URL("/sign-in", origin).href, { waitUntil: "networkidle" })
    await page.fill("input[name=email], input[type=email]", users.ada.email)
    await page.fill("input[name=password], input[type=password]", "notebook")
    await page.click("button[type=submit]")
    await page.waitForURL(url => url.pathname === "/", { timeout: 15_000 })
    // After a client-side navigation the load state is already reached, so wait for the text itself.
    const shows = (text: string) => page.getByText(text).first().waitFor({ timeout: 10_000 }).then(() => true, () => false)
    const listed = await shows(users.ada.notes[0]!)
    steps.push(`after sign-in on ${new URL(page.url()).pathname}, "${users.ada.notes[0]}" ${listed ? "shows" : "doesn't show"}`)

    let opened = false
    if (listed) {
      await page.getByText(users.ada.notes[0]!).first().click()
      opened = await shows(users.ada.body)
      steps.push(`clicking it opens ${new URL(page.url()).pathname}, body ${opened ? "shows" : "doesn't show"}`)
      await page.goBack()
      await shows(users.ada.notes[0]!)
    }

    const title = `Browser note ${Math.random().toString(36).slice(2, 8)}`
    let added = false
    if (listed) {
      await page.fill("input[name=title]", title)
      await page.fill("textarea[name=body], textarea", "Written by the grader.")
      await page.click("form button[type=submit]")
      added = await shows(title)
      steps.push(`adding "${title}" ${added ? "shows it in the list" : "doesn't show it"}`)
    }
    return { listed, opened, added, steps, requests }
  }
  finally {
    await context.close()
  }
}

const task: Task = {
  id: "fix-api-token",
  title: "Every page fails after sign-in",
  kind: "fix",
  rubric: true,
  plant: {
    base: "fix-api-token/base",
    edits: [
      { path: "app/plugins/api.ts", remove: true },
      { path: "app/composables/useAPI.ts", remove: true },
      { path: "app/components/AppHeader.vue", find: `useAPI("/api/me")`, replace: `useFetch("/api/me")` },
      { path: "app/pages/index.vue", find: `const { $api } = useNuxtApp()\n`, replace: "" },
      { path: "app/pages/index.vue", find: `useAPI("/api/notes"`, replace: `useFetch("/api/notes"` },
      { path: "app/pages/index.vue", find: `await $api("/api/notes"`, replace: `await $fetch("/api/notes"` },
      { path: "app/pages/notes/[id].vue", find: "useAPI(", replace: "useFetch(" },
    ],
  },
  vibe: "meetups/FIX-VIBE.md",
  timeLimitMinutes: 45,
  probes: [],
  judge: {
    groups: [{ name: "fix", sections: ["R", "S", "P", "C", "V"] }],
    setupChecks: ["C1"],
    build: "Read the app's README and package.json. node_modules is already installed for this package.json: don't install again unless that fails. Run `nuxt prepare` if `.nuxt` is missing, then make a production build (`nuxt build`, output in .output).",
    setupGrading: port => `Grade C1: start the production server on port ${port} (set PORT, NITRO_PORT, HOST=127.0.0.1 and NITRO_HOST=127.0.0.1), open the sign-in page, and stop the server. Start it with node, not pnpm (\`node .output/server/index.mjs\`, what \`pnpm start\` runs), and report that command as startCommand: pnpm refuses to run scripts over the copied node_modules.`,
    sharedServer: (origin, _group, app) => `The production build is running at ${origin}. Don't stop, restart or rebuild it, and don't run \`nuxt build\` or \`nuxt prepare\` in ${app}. Other graders use the same server at the same time. Sign in as ada@example.test or alan@example.test (password \`notebook\`); notes you add stay until the server stops.`,
    rules: () => [
      "Grade the agent's change to the app it got, from the patch and the code. The rest of the app is the same in every run. Accept every correct form of a fix: the ranked solutions in the rubric are the ones we know, not the only good ones. A fix that matches none of them is graded on its merits; say \"novel\" in the evidence of S1.",
      "The API in server/api belongs to another team (the README says so). A change there is not a fix of the web app.",
    ],
    apis: "Nuxt 5, Nitro v3, h3 v2 or Vue",
    scripted: {
      checks: ["F1", "F2", "S5", "C2", "C3"],
      async run({ origin, importPlaywright, log }) {
        const ada = await signIn(origin, users.ada.email)
        const alan = await signIn(origin, users.alan.email)

        const home = await render(origin, "/", ada)
        const note = await render(origin, `/notes/${users.ada.noteId}`, ada)
        const homeShows = users.ada.notes.every(title => home.html.includes(title))
        const noteShows = note.html.includes(users.ada.body)
        log(`server render: / ${home.status} notes ${homeShows ? "shown" : "missing"}, /notes/${users.ada.noteId} ${note.status} body ${noteShows ? "shown" : "missing"}`)

        // Two users' pages rendered at the same time: each must see only their own notes.
        const pairs = await Promise.all(Array.from({ length: 12 }, (_, index) => {
          const who = index % 2 ? "alan" : "ada"
          return render(origin, "/", who === "ada" ? ada : alan).then(page => ({ who, page }))
        }))
        const crossed = pairs.filter(({ who, page }) => {
          const own = users[who as "ada" | "alan"].notes
          const other = users[who === "ada" ? "alan" : "ada"].notes
          return !own.every(title => page.html.includes(title)) || other.some(title => page.html.includes(title))
        })

        const signedOut = await render(origin, "/")
        const sentAway = (signedOut.status >= 300 && signedOut.status < 400 && /\/sign-in/.test(signedOut.location ?? "")) || /<h1[^>]*>\s*Sign in\s*<\/h1>/.test(signedOut.html)

        const browser = await (await importPlaywright()).chromium.launch()
        let run: Awaited<ReturnType<typeof browse>>
        try {
          run = await browse(browser, origin)
        }
        finally {
          await browser.close()
        }
        const bare = run.requests.filter(request => !request.auth?.startsWith("Bearer "))
        // F2 is what the user sees, S5 where the header comes from: the browser's own requests must carry it, so a server
        // middleware that adds it in front of the API (it shares this Nitro app) works for F2 and fails S5 (#16).
        const browserOk = run.listed && run.opened && run.added
        const headerOk = run.requests.length > 0 && bare.length === 0
        log(`browser: ${run.steps.join("; ")}; ${run.requests.length} /api requests, ${bare.length} without the header`)

        return {
          F1: (homeShows && noteShows ? pass : fail)(`Server HTML with Ada's token cookie: / answered ${home.status} and ${homeShows ? "lists" : "doesn't list"} her notes; /notes/${users.ada.noteId} answered ${note.status} and ${noteShows ? "shows" : "doesn't show"} the note's text.`),
          F2: (browserOk ? pass : fail)(`In Chromium: ${run.steps.join("; ")}.`),
          S5: (headerOk ? pass : fail)(`In Chromium, ${run.requests.length} requests to /api after sign-in, ${bare.length} without a Bearer header${bare.length ? ` (${[...new Set(bare.map(request => request.path))].join(", ")})` : ""}.`),
          C2: (crossed.length === 0 ? pass : fail)(`12 server renders of / at once, Ada and Alan alternating: ${crossed.length} showed the wrong user's notes or missed their own.`),
          C3: (sentAway ? pass : fail)(`A visitor with no token loading / ${sentAway ? "is sent to the sign-in page" : `gets ${signedOut.status}${signedOut.location ? ` to ${signedOut.location}` : ""} without the sign-in page`}.`),
        }
      },
    },
  },
}

export default task
