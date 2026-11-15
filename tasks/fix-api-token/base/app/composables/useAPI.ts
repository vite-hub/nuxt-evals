export const useAPI = createUseFetch(() => ({ $fetch: useNuxtApp().$api as typeof $fetch }))
