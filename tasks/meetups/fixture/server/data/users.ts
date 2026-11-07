export interface User {
  id: string
  name: string
  role: "organizer" | "member"
}

const users: User[] = [
  { id: "ada", name: "Ada Lovelace", role: "organizer" },
  { id: "grace", name: "Grace Hopper", role: "organizer" },
  { id: "linus", name: "Linus Park", role: "member" },
]

export function listUsers(): User[] {
  return users
}

export function findUser(id: string): User | undefined {
  return users.find(user => user.id === id)
}
