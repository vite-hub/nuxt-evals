// Wrong: module-level state. On the server it is shared by every request at once.
const user = ref<{ id: string, name: string, role: string } | null>(null)

export function useCurrentUser() {
  return user
}
