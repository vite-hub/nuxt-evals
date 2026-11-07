export default defineNuxtRouteMiddleware(async () => {
  const user = await useRequestFetch()("/api/me")
  if (!user) return navigateTo("/login")
})
