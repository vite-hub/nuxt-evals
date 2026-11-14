type AuthSession = typeof authClient["$Infer"]["Session"]
export type SessionUser = Pick<AuthSession["user"], "id" | "name" | "email">

async function unwrap<T>(call: Promise<{ data: T, error: { message?: string } | null }>, fallback: string): Promise<T> {
  const { data, error } = await call
  if (error) throw new Error(error.message || fallback)
  return data
}

export function useAuth() {
  const user = useState<SessionUser | null>("auth:user", () => null)
  const requestFetch = useRequestFetch()

  async function fetchSession() {
    const session = await requestFetch<AuthSession | null>("/api/auth/get-session")
    user.value = session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null
  }

  async function signIn(credentials: { email: string, password: string }) {
    await unwrap(authClient.signIn.email(credentials), "Couldn't sign in")
    await fetchSession()
  }

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
    reloadNuxtApp({ path: "/", force: true })
  }

  return { user, fetchSession, signIn, signInWithPasskey, signUp, signOut }
}
