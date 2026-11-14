export default defineNuxtPlugin(async () => {
  const { fetchSession } = useAuth()
  await callOnce("session", fetchSession)
})
