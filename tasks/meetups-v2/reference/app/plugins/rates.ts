// Today's euro rates, loaded once per request on the server and carried to the browser in the payload,
// so every price on the page is converted in the first HTML. The API caches them for an hour.
export default defineNuxtPlugin({
  name: "rates",
  parallel: true,
  async setup() {
    const rates = useState<Rates | null>("rates", () => null)
    await callOnce("rates", async () => {
      try {
        // No retry: a hanging rates service must cost the page one short timeout, not two.
        rates.value = await $fetch("/api/rates", { retry: 0 })
      }
      catch (error) {
        // Prices fall back to euros (useCurrency); the page still renders.
        console.error("Exchange rates unavailable", error)
      }
    })
  },
})
