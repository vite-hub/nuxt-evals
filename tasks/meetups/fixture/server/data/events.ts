// The events store. It keeps every event in memory with its full record:
// a long description, the attendee list and the change history.

export interface Attendee {
  name: string
  email: string
  seats: number
  rsvpAt: string
}

export interface HistoryEntry {
  at: string
  by: string
  change: string
}

export interface MeetupEvent {
  id: number
  slug: string
  title: string
  city: string
  startsAt: string
  venue: { name: string, address: string }
  description: string
  /** Ticket price in euro cents. 0 means free. */
  priceCents: number
  capacity: number
  organizerId: string
  attendees: Attendee[]
  history: HistoryEntry[]
}

export const cities = ["Amsterdam", "Berlin", "Dublin", "Lisbon", "London", "Madrid", "Paris", "Prague", "Vienna", "Warsaw"]

const topics = ["Vue", "Nuxt", "Vite", "TypeScript", "Rust", "Design Systems", "Accessibility", "Testing", "Edge Computing", "Databases", "WebAssembly", "Open Source"]
const formats = ["Meetup", "Workshop", "Night", "Talks", "Hack Day", "Breakfast"]
const venues = ["Factory Hall", "The Loft", "Library Annex", "Co-Lab Space", "Harbor House", "Old Brewery", "Tech Hub", "Garden Room"]
const streets = ["Main Street", "Station Road", "River Lane", "Market Square", "Park Avenue", "Mill Road"]
const firstNames = ["Alex", "Sam", "Noor", "Mia", "Luca", "Ines", "Tomas", "Yuki", "Priya", "Omar", "Lena", "Jonas", "Chloe", "Ravi", "Elif", "Mateo"]
const lastNames = ["Berg", "Silva", "Novak", "Kowalski", "Dubois", "Garcia", "Jansen", "Murphy", "Rossi", "Weber", "Costa", "Horvat"]
const words = "community speakers share lessons from production projects with live demos questions and food we meet to learn build ship and talk about the tools we use every day bring a laptop and a friend newcomers are welcome the evening ends with drinks and open discussion slides and recordings follow after the event".split(" ")
const changes = ["Changed the venue", "Updated the description", "Added a speaker", "Moved the start time", "Raised the capacity", "Fixed a typo in the title", "Added a code of conduct link", "Changed the ticket price"]

function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const minute = 60_000
const day = 24 * 60 * minute

function createEvents(count: number): MeetupEvent[] {
  const next = random(42)
  const pick = <T>(list: T[]): T => list[Math.floor(next() * list.length)]!
  const today = new Date()
  const startOfDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const first = startOfDay - 2 * day
  const events: MeetupEvent[] = []
  for (let id = 1; id <= count; id++) {
    const topic = topics[id % topics.length]!
    const format = pick(formats)
    const city = cities[Math.floor(next() * cities.length)]!
    const title = `${topic} ${format} #${id}`
    const startsAt = first + id * 47 * minute + Math.floor(next() * 20) * minute
    const capacity = 40 + Math.floor(next() * 160)
    const attendees: Attendee[] = []
    const attendeeCount = 10 + Math.floor(next() * 30)
    for (let index = 0; index < attendeeCount; index++) {
      const firstName = pick(firstNames)
      const lastName = pick(lastNames)
      attendees.push({
        name: `${firstName} ${lastName}`,
        email: `${firstName}.${lastName}.${id}-${index}@attendee.test`.toLowerCase(),
        seats: 1 + Math.floor(next() * 2),
        rsvpAt: new Date(startOfDay - Math.floor(next() * 14) * day - Math.floor(next() * day)).toISOString(),
      })
    }
    const paragraphs = Array.from({ length: 4 }, () => Array.from({ length: 50 }, () => pick(words)).join(" "))
    events.push({
      id,
      slug: `${topic}-${format}-${id}`.toLowerCase().replaceAll(" ", "-"),
      title,
      city,
      startsAt: new Date(startsAt).toISOString(),
      venue: { name: `${pick(venues)} ${city}`, address: `${1 + Math.floor(next() * 120)} ${pick(streets)}, ${city}` },
      description: `${title} in ${city}. ${paragraphs.join("\n\n")}`,
      priceCents: next() < 0.3 ? 0 : 500 * (1 + Math.floor(next() * 8)),
      capacity,
      organizerId: id % 2 === 0 ? "ada" : "grace",
      attendees,
      history: Array.from({ length: 8 + Math.floor(next() * 8) }, (_, index) => ({
        at: new Date(startOfDay - (20 - index) * day).toISOString(),
        by: id % 2 === 0 ? "ada" : "grace",
        change: pick(changes),
      })),
    })
  }
  return events
}

const events = createEvents(2000)

/** Every event, oldest first, with full records. */
export function listEvents(): MeetupEvent[] {
  return events
}

export function findEvent(slug: string): MeetupEvent | undefined {
  return events.find(event => event.slug === slug)
}

export function seatsTaken(event: MeetupEvent): number {
  return event.attendees.reduce((sum, attendee) => sum + attendee.seats, 0)
}

export function seatsLeft(event: MeetupEvent): number {
  return Math.max(0, event.capacity - seatsTaken(event))
}

/** Saves an RSVP. Returns the updated event, or undefined when the event does not exist. */
export function addAttendee(slug: string, attendee: { name: string, email: string, seats: number }): MeetupEvent | undefined {
  const event = findEvent(slug)
  if (!event) return undefined
  event.attendees.push({ ...attendee, rsvpAt: new Date().toISOString() })
  return event
}
