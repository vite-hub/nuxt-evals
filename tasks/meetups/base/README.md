# Meetups

A small meetup.com for tech events on Nuxt 5, Nitro 3 and h3 2, with [ViteHub](https://vitehub.dev) for the database, auth with passkeys, email, cover photos, background jobs and rate limits, and Nuxt UI for the interface.

## Run it

Node 24.15 or newer and pnpm.

```sh
pnpm install
cp .env.example .env    # set BETTER_AUTH_SECRET
pnpm db:migrate         # creates .vitehub/data/database/sqlite.db
pnpm dev
```

Seed demo data once with the dev server running: open http://localhost:3000/_nitro/tasks/db:seed. It creates 240 events and three users (ada, grace and linus `@meetups.test`, password `meetups-demo-password`). Ada and Grace organize events; Linus only attends.

Production:

```sh
pnpm build
pnpm db:migrate
pnpm start    # node --env-file-if-exists=.env .output/server/index.mjs
```

Run both from the project root: the database, uploaded photos, queued jobs and caches live in `.vitehub/data`, relative to it. Run one server process per folder: the job queue and the reminder schedule run inside it.

Passkeys need a domain, so open the app at `http://localhost:<port>`, not `127.0.0.1`. In production they belong to the domain of `NUXT_PUBLIC_SITE_URL`.

Mail goes out from jobs: an RSVP queues its confirmation, and a schedule queues a reminder for every RSVP of an event that starts within a day. A failed send is retried (4 attempts) and logged; each email goes out at most once. In dev the messages wait in ViteHub's outbox:

```sh
pnpm vitehub email outbox list          # while pnpm dev runs
pnpm vitehub schedule run event-reminders   # send due reminders now instead of at the next quarter hour
pnpm vitehub queue jobs list            # jobs waiting or dead after their retries
```
 Don't run `pnpm build`, `pnpm typecheck`, `pnpm db:migrate` or `nuxt prepare` while `pnpm dev` runs: they all write `.nuxt`, and their generated ViteHub files (the email driver without the dev outbox, for one) replace the dev ones until dev restarts. Every setting is in `.env.example`. Set `NUXT_PUBLIC_SITE_URL` to the public origin in production: behind an HTTPS proxy the app sees plain http, and without it sign-in fails the origin check and the session cookie isn't `Secure`.

