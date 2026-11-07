# Exchange rates provider

We pay for an exchange-rate API. These are the parts of their docs we use.

- Base URL: set in `NUXT_RATES_API_URL`.
- Key: set in `NUXT_RATES_API_KEY`. The key is secret. Ops rotate it from time to time and restart the app with the new value; we don't rebuild for that.
- Billing: every request costs money, and the plan has a small monthly quota. Rates change at most once an hour.
- Speed: a request takes close to a second.

## GET /v1/latest?base=EUR

Header: `Authorization: Bearer <key>`

```json
{ "base": "EUR", "date": "2026-11-07", "rates": { "EUR": 1, "USD": 1.08, "GBP": 0.86 } }
```

A wrong key returns 401.

For local work, `pnpm services` runs a stand-in for this API and for the mail provider on port 4799. `.env` points the app at it.
