export const currencies = ["EUR", "USD", "GBP"] as const
export type Currency = (typeof currencies)[number]

/** How many units of each currency one euro buys. Prices are stored in euro cents. */
export type Rates = Record<Currency, number>

export function isCurrency(value: unknown): value is Currency {
  return currencies.includes(value as Currency)
}

/** The visitor's first language from an Accept-Language header, such as "en-GB" from "en-GB,en;q=0.9". */
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
