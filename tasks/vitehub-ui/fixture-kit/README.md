# Acme Console

A Nuxt 5 app where teams manage their projects. It is a work in progress.

## Run it

```sh
pnpm dev       # the app on http://localhost:3000
pnpm build     # production build in .output
pnpm preview   # serves the production build
```

## What is here

- The UI is [`@vite-hub/kit`](https://vitehub.dev): the parts of [ui-sdk](https://ui-sdk.dev) for Vue (`@ui-sdk/vue` and `@ui-sdk/core`), and the parts that ui-sdk lacks. The parts have behavior, focus, keyboard and ARIA, and no styles of their own. The kit's Nuxt module (`@vite-hub/kit/nuxt`) auto-imports every part, such as `<DialogTrigger>`. `app/assets/css/main.css` loads ui-sdk's stylesheet (`@ui-sdk/core/web.css`), which styles the parts through their `data-slot` attributes, and the app's own plain CSS.
- `server/utils/store.ts`: projects, members and deployments, in memory. Every start has the same seeded data.
- The JSON API, in `server/api`:
  - `GET /api/projects` lists the projects that are not archived. `POST /api/projects` creates one from `{ name, visibility }`, where `visibility` is `"private"` or `"public"`. It answers 400 when the name is empty or longer than 40 characters, and 409 when the name is taken.
  - `GET`, `PATCH` and `DELETE /api/projects/<slug>`. `PATCH` takes any of `name`, `visibility` and `defaultBranch` (`"main"`, `"develop"` or `"release"`).
  - `GET /api/projects/<slug>/members`: each member's `name`, `email` and `role`.
  - `GET /api/deployments`: 48 deployments, newest first, with `id`, `project`, `branch`, `status`, `author`, `createdAt` and `durationSeconds`.
  - `POST /api/orders` places an order from `{ address, cardName }`. It answers 400 when either one is empty. `GET /api/orders` lists the orders, each with `id`, `address`, `cardName` and `createdAt`. Orders stay in memory, in `server/utils/orders.ts`.
