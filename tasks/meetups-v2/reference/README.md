# Meetups (reference)

The reference answer for [Meetups v2](../PROMPT.md): a small meetup.com for tech events on Nuxt 5, Nitro 3 and h3 2, with [ViteHub](https://vitehub.dev) for the database, auth, email and rate limits, and Nuxt UI for the interface. [RUBRIC.md](../RUBRIC.md) is how we grade it and every agent run.

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
node .output/server/index.mjs
```

## Where things are

| Feature | Code |
| --- | --- |
| Events list, search, city filter, pages in the URL | `app/pages/index.vue`, `server/api/events/index.get.ts`, `shared/schemas/event.ts` |
| Event page, SEO, 404 | `app/pages/events/[slug]/index.vue`, `app/error.vue` |
| Times in the visitor's zone | `app/components/EventStart.vue` (`NuxtTime`) |
| Venue time in, UTC instant stored | `shared/utils/time.ts` |
| RSVP: one seat per person, never over capacity | `server/api/events/[slug]/rsvp.post.ts`, unique index in `server/databases/config.ts` |
| Live seats, paused in hidden tabs | `app/components/RsvpPanel.vue`, `server/api/events/[slug]/seats.get.ts` |
| Confirmation email after the response | `server/utils/mail.ts`, `event.waitUntil` in the RSVP route |
| Prices in USD, GBP or EUR | `app/composables/useCurrency.ts`, `server/api/rates.get.ts` (cached an hour) |
| Sign up, sign in, session in the first HTML | `server/auth.ts`, `app/composables/useAuth.ts`, `app/plugins/session.ts` |
| Organizer dashboard, chart, CSV | `app/pages/dashboard/`, `server/api/events/[slug]/attendees*.ts` |
| Create and edit events, one schema for form and API | `app/components/EventForm.vue`, `shared/schemas/event.ts` |
| Old `/e/<id>` links | `server/routes/e/[id].get.ts` (301) |
| Brand green, radius, dark mode | `app/app.config.ts`, `app/assets/css/main.css` |

## Choices worth knowing

- **Nuxt 5 has server auto-imports off.** Server files import from `nuxt/server`, `nitro/cache`, `vite-hub/*` and `#server/*`. The two routes that need `event.waitUntil()` and Rate Limit's client address use h3's `defineEventHandler`, because `nuxt/server`'s `RequestEvent` type has neither yet.
- **Capacity is enforced by one SQL statement** (`insert ... select ... where count < capacity`), and duplicates by a unique index. SQLite runs the statement atomically, so there is no check-then-insert race.
- **Light mode uses a darker green.** #00DC82 on white is 1.8:1. Light mode maps primary to #007a4a (5.4:1); dark mode keeps #00DC82.
