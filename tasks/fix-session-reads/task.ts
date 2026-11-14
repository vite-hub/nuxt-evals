import type { Browser } from "playwright-core"
import { fail, pass, Visitor } from "../meetups/checks.ts"
import { fixTask } from "../meetups/fix.ts"

/**
 * Corpus AU1, the "Vue portal" class (vite-hub/vitehub#4054 and #4044, Drop `b772236e`). The session plugin runs only in
 * the browser and the layout and the RSVP panel each read the session again on mount, so the server renders signed out
 * and a signed-in hard load sends get-session three times.
 */

/** A hard load in a fresh browser with `visitor`'s cookies: the browser's session reads and the page it ends on. */
async function hardLoad(browser: Browser, origin: string, path: string, visitor?: Visitor) {
  const context = await browser.newContext()
  try {
    if (visitor) await context.addCookies([...visitor.cookies].map(([name, value]) => ({ name, value, url: origin })))
    const page = await context.newPage()
    const reads: string[] = []
    const bodies: Promise<void>[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes("/api/auth/get-session")) reads.push(new URL(request.url()).pathname)
    })
    // A fix that moves the read to its own endpoint, such as /api/me, still reads the session in the browser.
    page.on("response", (response) => {
      const type = response.request().resourceType()
      const path = new URL(response.url()).pathname
      if (!visitor?.user || (type !== "fetch" && type !== "xhr") || path.includes("/api/auth/get-session")) return
      bodies.push(response.text().then((text) => {
        if (text.includes(visitor.user!.email)) reads.push(path)
      }, () => {}))
    })
    await page.goto(new URL(path, origin).href, { waitUntil: "load" })
    await page.waitForTimeout(3000)
    await Promise.all(bodies)
    return { reads, url: new URL(page.url()), html: await page.content() }
  }
  finally {
    await context.close()
  }
}

export default fixTask({
  id: "fix-session-reads",
  title: "Signed-in pages flash Sign in",
  edits: [
    { path: "app/plugins/session.ts", remove: true },
    {
      path: "app/plugins/session.client.ts",
      content: `export default defineNuxtPlugin(() => {
  const { fetchSession } = useAuth()
  fetchSession()
})
`,
    },
    {
      path: "app/layouts/default.vue",
      find: `const { user, signOut } = useAuth()
const toast = useToast()
`,
      replace: `const { user, fetchSession, signOut } = useAuth()
const toast = useToast()

onMounted(() => fetchSession())
`,
    },
    {
      path: "app/components/RsvpPanel.vue",
      find: "const { user } = useAuth()",
      replace: "const { user, fetchSession } = useAuth()",
    },
    {
      path: "app/components/RsvpPanel.vue",
      find: "onMounted(() => {\n",
      replace: "onMounted(() => {\n  fetchSession()\n",
    },
    {
      path: "app/middleware/auth.ts",
      content: `export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchSession } = useAuth()
  if (!user.value) await fetchSession()
  if (!user.value) return navigateTo({ path: "/sign-in", query: { redirect: to.fullPath } })
})
`,
    },
  ],
  scripted: {
    checks: ["F1", "F2", "C2"],
    async run({ origin, importPlaywright, log }) {
      const organizer = await new Visitor(origin).signUp("organizer")
      const slug = await organizer.createEvent()
      const reader = await new Visitor(origin).signUp("reader")
      const name = reader.user!.name
      const browser = await (await importPlaywright()).chromium.launch()
      try {
        const event = await hardLoad(browser, origin, `/events/${slug}`, reader)
        const named = event.html.includes(name)
        log(`event page: ${event.reads.length} browser session reads (${event.reads.join(", ") || "none"}), name shown: ${named}`)

        const server = await reader.send("GET", `/events/${slug}`, { headers: { accept: "text/html" } })
        const serverNamed = server.status === 200 && server.text.includes(name)
        const signInButton = />\s*Sign in\s*</.test(server.text)

        const signedIn = await hardLoad(browser, origin, "/dashboard", reader)
        const signedOut = await hardLoad(browser, origin, "/dashboard")
        const dashboardOpens = signedIn.url.pathname === "/dashboard" && signedIn.html.includes("Your events")
        const sentToSignIn = signedOut.url.pathname === "/sign-in"

        return {
          F1: (event.reads.length === 0 && named ? pass : fail)(`A signed-in visitor's hard load of an event page, watched for 3 s after load: ${event.reads.length} browser requests read the session (${event.reads.join(", ") || "none"}); the page ${named ? "shows" : "doesn't show"} their name.`),
          F2: (serverNamed ? pass : fail)(`The server HTML of the event page for a signed-in visitor (status ${server.status}) ${serverNamed ? "has" : "doesn't have"} their name, and ${signInButton ? "has a" : "has no"} "Sign in" button.`),
          C2: (dashboardOpens && sentToSignIn ? pass : fail)(`Hard load of /dashboard: signed in it ends on ${signedIn.url.pathname}${dashboardOpens ? " with the dashboard" : " without the dashboard"}; signed out it ends on ${signedOut.url.pathname}.`),
        }
      }
      finally {
        await browser.close()
      }
    },
  },
})
