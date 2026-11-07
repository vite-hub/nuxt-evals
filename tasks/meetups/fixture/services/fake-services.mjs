// Local stand-ins for the two paid services the app uses in production.
//   Exchange rates: GET /v1/latest?base=EUR with "Authorization: Bearer <key>". Slow, and billed per request.
//   Mail: POST /mail with JSON { to, subject, text }. Slow.
// Run it with `pnpm services`. It prints each billed request and each mail.
import { createServer } from "node:http"
import { pathToFileURL } from "node:url"

const rates = { EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.94, PLN: 4.31, CZK: 25.2, SEK: 11.4 }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

export function startFakeServices({ port = 4799, host = "127.0.0.1", apiKey = "dev-rates-key", rateDelayMs = 800, mailDelayMs = 1500, log = false } = {}) {
  const counts = { rates: 0, rejected: 0, mails: 0 }
  const mails = []
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")
    const send = (status, body) => {
      response.writeHead(status, { "content-type": "application/json" })
      response.end(JSON.stringify(body))
    }
    if (request.method === "GET" && url.pathname === "/v1/latest") {
      if (request.headers.authorization !== `Bearer ${apiKey}`) {
        counts.rejected++
        return send(401, { error: "Invalid API key" })
      }
      counts.rates++
      if (log) console.log(`rates: billed request #${counts.rates}`)
      await wait(rateDelayMs)
      const base = url.searchParams.get("base") ?? "EUR"
      if (base !== "EUR") return send(400, { error: "Only base=EUR is supported" })
      return send(200, { base, date: new Date().toISOString().slice(0, 10), rates })
    }
    if (request.method === "POST" && url.pathname === "/mail") {
      let raw = ""
      for await (const chunk of request) raw += chunk
      await wait(mailDelayMs)
      const message = JSON.parse(raw || "{}")
      counts.mails++
      mails.push(message)
      if (log) console.log(`mail #${counts.mails} to ${message.to}: ${message.subject}`)
      return send(202, { id: `mail_${counts.mails}` })
    }
    send(404, { error: "Not found" })
  })
  const ready = new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, host, () => resolve())
  })
  return {
    url: `http://${host}:${port}`,
    counts,
    mails,
    rates,
    ready,
    close: () => new Promise(resolve => server.close(() => resolve())),
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const services = startFakeServices({ port: Number(process.env.PORT ?? 4799), apiKey: process.env.NUXT_RATES_API_KEY ?? "dev-rates-key", log: true })
  await services.ready
  console.log(`Fake rates and mail services on ${services.url}`)
}
