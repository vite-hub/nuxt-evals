import { defineCachedFunction } from "nitro/cache"
import { useRuntimeConfig } from "nuxt/server"

export type Currency = "EUR" | "USD" | "GBP"

const getRates = defineCachedFunction(async (): Promise<Record<string, number>> => {
  const config = useRuntimeConfig()
  const response = await fetch(`${config.ratesApi.url}/v1/latest?base=EUR`, { headers: { authorization: `Bearer ${config.public.ratesApiKey}` } })
  if (!response.ok) throw new Error(`The rates provider answered ${response.status}.`)
  return (await response.json() as { rates: Record<string, number> }).rates
}, { name: "exchange-rates", maxAge: 60 * 60, getKey: () => "EUR" })

export function currencyFor(acceptLanguage: string | undefined): Currency {
  const region = acceptLanguage?.split(",")[0]?.split("-")[1]?.toUpperCase()
  return region === "US" ? "USD" : region === "GB" ? "GBP" : "EUR"
}

export async function formatPrice(cents: number, currency: Currency): Promise<string> {
  if (cents === 0) return "Free"
  const rate = currency === "EUR" ? 1 : await getRates().then(rates => rates[currency]!, () => undefined)
  if (rate === undefined) return new Intl.NumberFormat("en", { style: "currency", currency: "EUR" }).format(cents / 100)
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(Math.round(cents * rate) / 100)
}
