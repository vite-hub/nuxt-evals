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

## Where things are

| Feature | Code |
| --- | --- |
| Events list, search, city filter, pages in the URL | `app/pages/index.vue`, `server/api/events/index.get.ts`, `shared/schemas/event.ts` |
| Event page, SEO, 404 | `app/pages/events/[slug]/index.vue`, `app/error.vue` |
| Times in the visitor's zone | `app/components/EventStart.vue` (`NuxtTime`) |
| Venue time in, UTC instant stored | `shared/utils/time.ts` |
| RSVP: one seat per person, never over capacity | `server/api/events/[slug]/rsvp.post.ts`, unique index in `server/databases/config.ts` |
| Live seats, paused in hidden tabs | `app/components/RsvpPanel.vue`, `server/api/events/[slug]/seats.get.ts` |
| Confirmation and reminder emails, sent once each | `server/queues/`, `server/schedules/event-reminders.ts`, `server/utils/mail.ts`, `server/emails/` |
| Prices in USD, GBP or EUR | `app/composables/useCurrency.ts`, `server/api/rates.get.ts` (cached an hour) |
| Sign up, sign in, session in the first HTML | `server/auth.ts`, `app/composables/useAuth.ts`, `app/plugins/session.ts` |
| Password reset by email | `server/auth.ts` (`sendResetPassword`), `app/pages/forgot-password.vue`, `app/pages/reset-password.vue` |
| Security headers in production | `$production.routeRules` in `nuxt.config.ts` |
| Passkeys: add, list, remove, sign in | `server/auth.ts` (`passkey()`), `app/pages/account.vue`, `app/utils/auth-client.ts`, the `passkey` table in `server/databases/config.ts` |
| Cover photos: upload, resize, remove | `server/api/events/[slug]/cover.*.ts`, `app/components/EventCover.vue`, the `/images` route in `nuxt.config.ts` |
| Organizer dashboard, chart, CSV | `app/pages/dashboard/`, `server/api/events/[slug]/attendees*.ts` |
| Create and edit events, one schema for form and API | `app/components/EventForm.vue`, `shared/schemas/event.ts` |
| Old `/e/<id>` links | `server/routes/e/[id].get.ts` (301) |
| Brand green, radius, dark mode | `app/app.config.ts`, `app/assets/css/main.css` |

## Choices worth knowing

- **Nuxt 5 has server auto-imports off.** Server files import from `nuxt/server`, `nitro/*`, `vite-hub/*` and `#server/*`.
- **Each email is sent at most once.** The job first marks the RSVP's `confirmation_sent_at` or `reminder_sent_at` in one statement; a retried or duplicate job finds it set and stops. A refused send clears the mark and throws, so the queue tries again.
- **The Node server runs the jobs itself.** `schedule: { runtime: { driver: "process" } }` runs the reminder schedule in the server process (a Node build with `schedule: true` alone fails: nothing would run it), and the schedule keeps its runs in ViteHub KV.
- **Uploads are checked by their bytes.** The server accepts JPEG, PNG and WebP up to 4 MB, and the first bytes must match the declared type. SVG stays out because it can carry script. `/images` serves them with `nosniff`, and `?w=640` asks sharp for a smaller copy.
- **Capacity is enforced by one SQL statement** (`insert ... select ... where count < capacity`), and duplicates by a unique index. SQLite runs the statement atomically, so there is no check-then-insert race.
- **Light mode uses a darker green.** #00DC82 on white is 1.8:1. Light mode maps primary to #007a4a (5.4:1); dark mode keeps #00DC82.
