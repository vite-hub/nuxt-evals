/** Better Auth's session type, inferred from its client. */
type AuthSession = ReturnType<typeof useAuthClient>["$Infer"]["Session"]
export type SessionUser = Pick<AuthSession["user"], "id" | "name" | "email">

/**
 * The signed-in user, shared by every component. plugins/session.ts loads it once on the server
 * (with the visitor's cookie), and the payload carries it to the browser.
 */
export function useAuth() {
  const user = useState<SessionUser | null>("auth:user", () => null)
  const requestFetch = useRequestFetch()

  async function fetchSession() {
    // Better Auth's route is mounted by ViteHub, so $fetch can't infer its type from a server route file.
    const session = await requestFetch<AuthSession | null>("/api/auth/get-session")
    user.value = session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null
  }

  async function signIn(credentials: { email: string, password: string }) {
    const { error } = await useAuthClient().signIn.email(credentials)
    if (error) throw new Error(error.message ?? "Couldn't sign in")
    await fetchSession()
  }

  async function signUp(details: { name: string, email: string, password: string }) {
    const { error } = await useAuthClient().signUp.email(details)
    if (error) throw new Error(error.message ?? "Couldn't create the account")
    await fetchSession()
  }

  async function signOut() {
    await useAuthClient().signOut()
    user.value = null
    // Personal data (RSVPs, the dashboard) must not survive in the cache for the next person.
    clearNuxtData()
    await navigateTo("/")
  }

  return { user, fetchSession, signIn, signUp, signOut }
}
