export const currencies = ["EUR", "USD", "GBP"] as const
export type Currency = (typeof currencies)[number]

export type Rates = Record<Currency, number>

export function isCurrency(value: unknown): value is Currency {
  return currencies.includes(value as Currency)
}

export function preferredLocale(acceptLanguage: string | null | undefined): string {
  const first = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim()
  if (!first || first === "*") return "en-US"
  try {
    return new Intl.Locale(first).toString()
  }
  catch {
    return "en-US"
  }
}

export function currencyForLocale(locale: string): Currency {
  const region = new Intl.Locale(locale).maximize().region
  if (region === "US") return "USD"
  if (region === "GB") return "GBP"
  return "EUR"
}
