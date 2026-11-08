/**
 * Prices are stored in euro cents and shown in the visitor's currency. The first visit picks it
 * from the browser language; the picker saves a choice in a cookie, so the server renders the
 * right currency in the first HTML.
 */
export function useCurrency() {
  const locale = useState("locale", () => preferredLocale(useRequestHeader("accept-language")))
  const saved = useCookie<string | null>("currency", { default: () => null, maxAge: 60 * 60 * 24 * 365, sameSite: "lax" })
  const currency = computed<Currency>({
    get: () => (isCurrency(saved.value) ? saved.value : currencyForLocale(locale.value)),
    set: (value) => { saved.value = value },
  })
  const { data: rates } = useFetch("/api/rates", { key: "rates", dedupe: "defer" })

  function formatPrice(euroCents: number): string {
    if (euroCents === 0) return "Free"
    // Without today's rate, show the euro price rather than a wrong number.
    const rate = rates.value?.[currency.value]
    const shown = rate ? currency.value : "EUR"
    return new Intl.NumberFormat(locale.value, { style: "currency", currency: shown })
      .format((euroCents / 100) * (rate ?? 1))
  }

  return { currency, formatPrice }
}
