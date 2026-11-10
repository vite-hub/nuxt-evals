export default defineNuxtRouteMiddleware((to) => {
  const { user } = useAuth()
  if (!user.value) return navigateTo({ path: "/sign-in", query: { redirect: to.fullPath } })
})
