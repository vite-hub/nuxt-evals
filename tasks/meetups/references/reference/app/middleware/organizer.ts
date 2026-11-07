export default defineNuxtRouteMiddleware(async () => {
  const user = await useRequestFetch()("/api/me")
  if (!user) return navigateTo("/login")
  if (user.role !== "organizer") return abortNavigation(createError({ status: 403, statusText: "Only organizers can open the dashboard" }))
})
