export type CurrencyChoice = "auto" | "USD" | "EUR" | "GBP"

/** The visitor's currency choice. A cookie, so the server renders the chosen currency on the first request. */
export function useCurrency() {
  return useCookie<CurrencyChoice>("currency", { default: () => "auto", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" })
}
