// Plugins run before route middleware, so the auth middleware already knows who is signed in on the first request.
export default defineNuxtPlugin(async () => {
  const { fetchSession } = useAuth()
  await callOnce("session", fetchSession)
})
