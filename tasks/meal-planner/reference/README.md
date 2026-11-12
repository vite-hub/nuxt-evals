# Meal planner

Browse 20,289 recipes, plan the week for the people you cook for, and get a shopping list that knows what is already in the pantry. A single-page app built with Vue 3, Vue Router 5, VueUse and Vite, in English and Spanish. There is no backend: the recipes ship with the app (`data/`), everything the user adds stays in the browser's `localStorage`, and a service worker keeps it working offline.

## Run it

Needs Node 22 or later and pnpm.

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # unit and component tests (Vitest)
pnpm typecheck    # vue-tsc
pnpm build        # type check, then the production build in dist/
pnpm preview      # serves dist/ at http://localhost:4173
```

The service worker only runs in the production build (`pnpm build && pnpm preview`).

## Deploy

`pnpm build` writes a static site to `dist/`. Any static host works, as long as it answers every path with `index.html`, since the app uses HTML5 history (`/en/plan/2026-11-09`, `/es/recipes/123`):

- Netlify and Cloudflare Pages read `public/_redirects`, which the build copies to `dist/`.
- nginx: `location / { try_files $uri /index.html; }`
- Vercel: a `vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

Serve `sw.js` and `index.html` without long caching; everything else has a content hash in its name and can be cached forever.

## How it works

- **Data.** `build/recipe-data.ts` turns `data/recipes.json` (19 MB) into what the app loads: a column index of every recipe for the list and search (titles, folded search text, filters, and the orders sorted at build time, by name once per language), the full recipes in shards of 100 ids that load when a page needs them, and the ingredients. Every file is named after a hash of its content.
- **Logic.** `src/domain/` is plain TypeScript, tested on its own: units, densities and amounts (`units.ts`, `format.ts`), the list index and search (`recipe-index.ts`), dates and weeks, households and diet warnings (`household.ts`, `warnings.ts`), the shopping list and pantry (`shopping.ts`), share links (`share.ts`), the recipe form, and the checks for data from storage and files (`schema.ts`).
- **State.** `src/composables/` holds the shared state: recipes, the plan with its undo history, the household, the pantry, the shopping list, settings. Each is kept in `localStorage` as `{ version, data }` and checked when read; other open tabs follow along through the `storage` event.
- **Languages.** Every page lives under its language, `/en/...` or `/es/...`. The first visit follows the browser; the switch in the header remembers the choice. Messages are in `src/i18n/`; Spanish is typed as the English catalog, so a missing key is a type error.
- **Offline and updates.** `build/sw.js` (filled in by `build/service-worker.ts` for each build) keeps the app and the list index offline and caches each recipe shard once it is opened. A new version waits until the user accepts the banner; a recipe form being written is kept as a draft, so nothing is lost.
- **Sharing.** A week's link carries the week itself, compressed in the URL's hash: `/en/shared#…`. Opening it shows the week and saves nothing until the user copies it.
- **Old links.** Links from the old app (`/#/recipe/123`, `/#/plan`) are turned into today's addresses before any page renders.

## Data

`data/recipes.json` and `data/ingredients.json` come from the old site; `data/README.md` describes the fields, the densities and the US measures. Settings > Your data exports everything the user added to one JSON file and imports it back.
