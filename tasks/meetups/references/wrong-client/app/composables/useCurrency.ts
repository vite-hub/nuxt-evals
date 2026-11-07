export type CurrencyChoice = "auto" | "USD" | "EUR" | "GBP"

// Wrong: localStorage. The server never sees the choice.
export function useCurrency() {
  return useLocalStorage<CurrencyChoice>("currency", "auto")
}
