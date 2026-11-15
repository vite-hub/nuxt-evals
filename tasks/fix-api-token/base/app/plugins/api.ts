export default defineNuxtPlugin((nuxtApp) => {
  const token = useCookie<string | null>("token")
  const api = $fetch.create({
    onRequest({ options }) {
      if (token.value) options.headers.set("Authorization", `Bearer ${token.value}`)
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        token.value = null
        await nuxtApp.runWithContext(() => navigateTo("/sign-in"))
      }
    },
  })
  return { provide: { api } }
})
