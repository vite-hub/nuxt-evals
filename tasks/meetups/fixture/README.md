# Meetups

A Nuxt app for tech meetups. It is a work in progress.

## Run it

```sh
pnpm dev        # the app on http://localhost:3000
pnpm services   # local stand-ins for the paid exchange-rate and mail services, on port 4799
```

`.env` holds the local settings. Production sets the same variables in its environment.

## What is here

- `server/data/events.ts`: the event store. It keeps about 2,000 events in memory with their full records.
- `server/data/users.ts`: the users. Ada and Grace organize events, Linus is a member.
- `server/utils/session.ts`: `getSessionUser(event)` returns the signed-in user. It reads the session store, which takes about 15 ms in production too. `/login` signs you in as a demo user.
- `server/utils/mailer.ts`: `sendMail()` sends an email through the mail provider.
- `docs/rates-api.md`: the exchange-rate provider we pay for.
- `chart.js` is installed for charts, and VueUse (`@vueuse/nuxt`) for composables.
