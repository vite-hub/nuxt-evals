export type Currency = "EUR" | "USD" | "GBP"

async function getRates(): Promise<Record<string, number>> {
  const response = await fetch(`${process.env.NUXT_RATES_API_URL}/v1/latest?base=EUR`, {
    headers: { authorization: `Bearer ${process.env.NUXT_RATES_API_KEY}` },
  })
  const body = await response.json() as { rates: Record<string, number> }
  return body.rates
}

export function currencyFor(acceptLanguage: string | undefined): Currency {
  const region = acceptLanguage?.split(",")[0]?.split("-")[1]?.toUpperCase()
  return region === "US" ? "USD" : region === "GB" ? "GBP" : "EUR"
}

export async function formatPrice(cents: number, currency: Currency): Promise<string> {
  if (cents === 0) return "Free"
  const rate = currency === "EUR" ? 1 : (await getRates())[currency]!
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(Math.round(cents * rate) / 100)
}
