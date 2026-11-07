import { defineCachedFunction } from "nitro/cache"
import { useRuntimeConfig } from "nuxt/server"

export type Currency = "EUR" | "USD" | "GBP"

/** The provider bills each request and updates rates hourly, so every visitor shares one cached copy. */
const getRates = defineCachedFunction(async (): Promise<Record<string, number>> => {
  const { ratesApi } = useRuntimeConfig()
  const response = await fetch(`${ratesApi.url}/v1/latest?base=EUR`, { headers: { authorization: `Bearer ${ratesApi.key}` } })
  if (!response.ok) throw new Error(`The rates provider answered ${response.status}.`)
  const body = await response.json() as { rates: Record<string, number> }
  return body.rates
}, { name: "exchange-rates", maxAge: 60 * 60, getKey: () => "EUR" })

/** The visitor's choice when they made one, otherwise the region of their browser language. */
export function currencyFor(acceptLanguage: string | undefined, choice?: unknown): Currency {
  if (choice === "USD" || choice === "EUR" || choice === "GBP") return choice
  const region = acceptLanguage?.split(",")[0]?.split(";")[0]?.split("-")[1]?.toUpperCase()
  return region === "US" ? "USD" : region === "GB" ? "GBP" : "EUR"
}

export async function formatPrice(cents: number, currency: Currency): Promise<string> {
  if (cents === 0) return "Free"
  const rate = currency === "EUR" ? 1 : (await getRates())[currency]!
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(Math.round(cents * rate) / 100)
}
