import { defineCachedFunction } from "nitro/cache"
import { defineEventHandler, useRuntimeConfig } from "nuxt/server"
import { z } from "zod"
import type { Rates } from "#shared/utils/currency"

const ratesResponseSchema = z.object({ rates: z.object({ USD: z.number().positive(), GBP: z.number().positive() }) })

const latestRates = defineCachedFunction(async (): Promise<Rates> => {
  const { rates } = useRuntimeConfig()
  const url = new URL(rates.url)
  url.searchParams.set("base", "EUR")
  url.searchParams.set("symbols", "USD,GBP")
  const response = await fetch(url, {
    headers: rates.apiKey ? { authorization: `Bearer ${rates.apiKey}` } : {},
    signal: AbortSignal.timeout(1500),
  })
  if (!response.ok) throw new Error(`Rates service answered ${response.status}`)
  const { rates: latest } = ratesResponseSchema.parse(await response.json())
  return { EUR: 1, ...latest }
}, { name: "rates", maxAge: 60 * 60, swr: true })

export default defineEventHandler(() => latestRates())
