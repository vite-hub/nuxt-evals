export default defineNuxtPlugin(async () => {
  const user = useCurrentUser()
  user.value = await useRequestFetch()("/api/me")
})
