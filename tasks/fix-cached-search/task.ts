import { fail, pass, tag, Visitor } from "../meetups/checks.ts"
import { fixTask } from "../meetups/fix.ts"

/**
 * Corpus KV6. The events list route is wrapped in `defineCachedHandler`, which in Nitro v3 passes no query parameters
 * to the handler or the key (ocache `allowQuery`). Nitro 2's cached handlers keyed by the whole URL; old posts teach it.
 */
export default fixTask({
  id: "fix-cached-search",
  title: "Search and pages show the same events",
  edits: [
    {
      path: "server/api/events/index.get.ts",
      find: "import { defineEventHandler, getValidatedQuery } from \"nuxt/server\"",
      replace: "import { defineCachedHandler } from \"nitro/cache\"\nimport { getValidatedQuery } from \"nuxt/server\"",
    },
    {
      path: "server/api/events/index.get.ts",
      find: "export default defineEventHandler(async (event) => {",
      replace: "export default defineCachedHandler(async (event) => {",
    },
    {
      path: "server/api/events/index.get.ts",
      find: "    pageSize: EVENTS_PAGE_SIZE,\n  }\n})",
      replace: "    pageSize: EVENTS_PAGE_SIZE,\n  }\n}, { name: \"events\", maxAge: 60 })",
    },
  ],
  scripted: {
    checks: ["F1", "C2"],
    async run({ origin, log }) {
      const city = `Checkville ${tag()}`
      const word = `zebra${tag()}`
      const organizers = [await new Visitor(origin).signUp("organizer-a"), await new Visitor(origin).signUp("organizer-b")]
      for (let index = 0; index < 14; index++) {
        await organizers[index % 2]!.createEvent({ city, title: index === 5 ? `Talks about ${word}` : `City meetup ${index + 1}`, days: 3 + index })
      }
      const visitor = new Visitor(origin)
      type List = { items: { slug: string, title: string, city: string }[], total: number }
      const list = (query: string) => visitor.getJson<List>(`/api/events${query}`)
      await list("")
      const first = await list(`?city=${encodeURIComponent(city)}`)
      const second = await list(`?city=${encodeURIComponent(city)}&page=2`)
      const search = await list(`?q=${word}`)
      const cityOnly = first.items.length === 12 && first.items.every(item => item.city === city) && first.total === 14
      const pages = second.items.length === 2 && second.items.every(item => item.city === city) && !second.items.some(item => first.items.some(other => other.slug === item.slug))
      const found = search.items.length === 1 && search.items[0]!.title.includes(word)
      const seen = `City filter: ${first.items.length} items, ${first.items.filter(item => item.city === city).length} in the city, total ${first.total} (expected 12 of 14). Page 2: ${second.items.length} items, ${second.items.filter(item => first.items.some(other => other.slug === item.slug)).length} repeated from page 1 (expected 2 new). Search for one title's word: ${search.items.length} items${search.items[0] ? `, first "${search.items[0].title}"` : ""} (expected 1).`
      log(seen)
      const html = await visitor.get(`/?q=${word}`)
      return {
        F1: (cityOnly && pages && found ? pass : fail)(seen),
        C2: (html.status === 200 && html.text.includes(`Talks about ${word}`) ? pass : fail)(`The home page for the search answered ${html.status} and ${html.text.includes(`Talks about ${word}`) ? "shows" : "doesn't show"} the matching event in its server HTML.`),
      }
    },
  },
})
