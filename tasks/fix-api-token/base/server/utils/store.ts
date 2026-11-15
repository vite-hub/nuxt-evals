import { createError, type RequestEvent } from "nuxt/server"

export interface Note {
  id: string
  userId: string
  title: string
  body: string
  createdAt: string
}

interface User {
  id: string
  email: string
  name: string
  password: string
}

// Stand-in for the mobile API's database.
const users: User[] = [
  { id: "u-ada", email: "ada@example.test", name: "Ada", password: "notebook" },
  { id: "u-alan", email: "alan@example.test", name: "Alan", password: "notebook" },
]

const notes: Note[] = [
  { id: "n-ada-1", userId: "u-ada", title: "Engine notes", body: "The engine weaves algebraic patterns.", createdAt: "2026-11-01T09:00:00.000Z" },
  { id: "n-ada-2", userId: "u-ada", title: "Bernoulli numbers", body: "Table of operations for note G.", createdAt: "2026-11-02T09:00:00.000Z" },
  { id: "n-alan-1", userId: "u-alan", title: "Imitation game", body: "Can machines think?", createdAt: "2026-11-03T09:00:00.000Z" },
]

const tokens = new Map<string, string>()

export function signIn(email: string, password: string): string | undefined {
  const user = users.find(candidate => candidate.email === email.toLowerCase() && candidate.password === password)
  if (!user) return undefined
  const token = crypto.randomUUID()
  tokens.set(token, user.id)
  return token
}

export function requireUser(event: RequestEvent) {
  const token = event.req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1]
  const user = token ? users.find(candidate => candidate.id === tokens.get(token)) : undefined
  if (!user) throw createError({ status: 401, statusText: "Send the token in an Authorization: Bearer header" })
  return { id: user.id, email: user.email, name: user.name }
}

export function notesOf(userId: string): Note[] {
  return notes.filter(note => note.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function addNote(userId: string, input: { title: string, body: string }): Note {
  const note = { id: crypto.randomUUID(), userId, ...input, createdAt: new Date().toISOString() }
  notes.push(note)
  return note
}
