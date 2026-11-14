import { fail, multipart, pass, tinyPng, Visitor } from "../meetups/checks.ts"
import { fixTask } from "../meetups/fix.ts"

/**
 * Corpus AU7, write form. The event edit route and the cover removal look the event up by slug and only check that
 * someone is signed in. Rubric A4 failed in 4 of 15 graded Meetups runs; Drop `0b2c2d7d`; joxi `1fd3769`.
 */
export default fixTask({
  id: "fix-owner-check",
  title: "Strangers can edit an event",
  edits: [
    {
      path: "server/api/events/[slug]/index.patch.ts",
      find: "import { findOwnedEvent } from \"#server/utils/events\"",
      replace: "import { findEventBySlug } from \"#server/utils/events\"",
    },
    {
      path: "server/api/events/[slug]/index.patch.ts",
      find: "  const user = await requireUser(event)\n  const found = await findOwnedEvent(getRouterParam(event, \"slug\")!, user.id)",
      replace: "  await requireUser(event)\n  const found = await findEventBySlug(getRouterParam(event, \"slug\")!)",
    },
    {
      path: "server/api/events/[slug]/cover.delete.ts",
      find: "import { findOwnedEvent } from \"#server/utils/events\"",
      replace: "import { findEventBySlug } from \"#server/utils/events\"",
    },
    {
      path: "server/api/events/[slug]/cover.delete.ts",
      find: "  const user = await requireUser(event)\n  const found = await findOwnedEvent(getRouterParam(event, \"slug\")!, user.id)",
      replace: "  await requireUser(event)\n  const found = await findEventBySlug(getRouterParam(event, \"slug\")!)",
    },
  ],
  scripted: {
    checks: ["F1", "C2"],
    async run({ origin, log }) {
      const organizer = await new Visitor(origin).signUp("organizer")
      const stranger = await new Visitor(origin).signUp("stranger")
      const title = `Owner check ${Date.now()}`
      const slug = await organizer.createEvent({ title, capacity: 20 })
      const upload = await organizer.send("PUT", `/api/events/${slug}/cover`, multipart("cover", { name: "cover.png", type: "image/png", data: tinyPng }))
      const coverBefore = (await organizer.getJson<{ coverPath: string | null }>(`/api/events/${slug}`)).coverPath
      log(`cover upload ${upload.status}, cover ${coverBefore ?? "none"}`)

      const start = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 13) + ":00"
      const body = { title: "Changed by a stranger", description: "A stranger rewrote this meetup's details.", city: "Lisbon", venue: "Check Hall", startsAtLocal: start, timeZone: "UTC", capacity: 20, priceCents: 0 }
      const edit = await stranger.send("PATCH", `/api/events/${slug}`, { json: { ...body, startsAtLocal: new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 13) + ":00" } })
      const remove = await stranger.send("DELETE", `/api/events/${slug}/cover`)
      const after = await organizer.getJson<{ title: string, coverPath: string | null }>(`/api/events/${slug}`)
      const refused = (status: number) => status === 403 || status === 404
      const kept = after.title === title && after.coverPath === coverBefore
      const fixed = refused(edit.status) && refused(remove.status) && kept
      const seen = `The stranger's edit answered ${edit.status}, their cover removal ${remove.status}; afterwards the title is "${after.title}" and the cover ${after.coverPath === coverBefore ? "is unchanged" : `changed from ${coverBefore} to ${after.coverPath}`}.${coverBefore ? "" : " (The organizer's cover upload failed, so the removal check had no cover to protect.)"}`

      const own = await organizer.send("PATCH", `/api/events/${slug}`, { json: { ...body, title: `${title} (edited)`, startsAtLocal: new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 13) + ":00" } })
      const ownRemove = await organizer.send("DELETE", `/api/events/${slug}/cover`)
      const peek = await stranger.send("GET", `/api/events/${slug}/attendees`)
      const owner = own.status === 200 && ownRemove.status === 200 && refused(peek.status)
      return {
        F1: (fixed && coverBefore ? pass : fail)(seen),
        C2: (owner ? pass : fail)(`The organizer's own edit answered ${own.status} and cover removal ${ownRemove.status}; the stranger's attendee list request answered ${peek.status}.`),
      }
    },
  },
})
