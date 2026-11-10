/** Better Auth's session type, inferred from its client. */
type AuthSession = typeof authClient["$Infer"]["Session"]
export type SessionUser = Pick<AuthSession["user"], "id" | "name" | "email">

/** Better Auth answers `{ data, error }`; turn an error into a thrown one with its message. */
async function unwrap<T>(call: Promise<{ data: T, error: { message?: string } | null }>, fallback: string): Promise<T> {
  const { data, error } = await call
  if (error) throw new Error(error.message || fallback)
  return data
}

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
    await unwrap(authClient.signIn.email(credentials), "Couldn't sign in")
    await fetchSession()
  }

  /** The browser asks for a passkey this site knows; no email needed. */
  async function signInWithPasskey() {
    await unwrap(authClient.signIn.passkey(), "Couldn't sign in with a passkey")
    await fetchSession()
  }

  async function signUp(details: { name: string, email: string, password: string }) {
    await unwrap(authClient.signUp.email(details), "Couldn't create the account")
    await fetchSession()
  }

  async function signOut() {
    await unwrap(authClient.signOut(), "Couldn't sign out")
    // A fresh load of the home page: nothing personal (RSVPs, the dashboard, cached pages) survives for the next person.
    // `force`, because the reload guard skips a reload within 10 s of the last one, such as a quick sign-in and out.
    reloadNuxtApp({ path: "/", force: true })
  }

  return { user, fetchSession, signIn, signInWithPasskey, signUp, signOut }
}
