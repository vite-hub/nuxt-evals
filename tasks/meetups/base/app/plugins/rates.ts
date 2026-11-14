export default defineNuxtPlugin({
  name: "rates",
  parallel: true,
  async setup() {
    const rates = useState<Rates | null>("rates", () => null)
    await callOnce("rates", async () => {
      try {
        rates.value = await $fetch("/api/rates", { retry: 0 })
      }
      catch (error) {
        console.error("Exchange rates unavailable", error)
      }
    })
  },
})
