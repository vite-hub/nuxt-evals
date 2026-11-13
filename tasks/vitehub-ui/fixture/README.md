# Acme Console

A Nuxt 5 app where teams manage their projects. It is a work in progress.

## Run it

```sh
pnpm dev       # the app on http://localhost:3000
pnpm build     # production build in .output
pnpm preview   # serves the production build
```

## What is here

- The UI is [Nuxt UI](https://ui.nuxt.com) and ViteHub UI (`@vite-hub/ui`, docs at https://vitehub.dev/docs/ui). `vite-hub/nuxt` sets up ViteHub UI and auto-imports its components. `ai` and `@ai-sdk/vue` are installed for the assistant.
- `server/utils/store.ts`: projects, members and deployments, in memory. Every start has the same seeded data.
- The JSON API, in `server/api`:
  - `GET /api/projects` lists the projects that are not archived. `POST /api/projects` creates one from `{ name, visibility }`, where `visibility` is `"private"` or `"public"`. It answers 400 when the name is empty or longer than 40 characters, and 409 when the name is taken.
  - `GET`, `PATCH` and `DELETE /api/projects/<slug>`. `PATCH` takes any of `name`, `visibility` and `defaultBranch` (`"main"`, `"develop"` or `"release"`).
  - `GET /api/projects/<slug>/members`: each member's `name`, `email` and `role`.
  - `GET /api/deployments`: 48 deployments, newest first, with `id`, `project`, `branch`, `status`, `author`, `createdAt` and `durationSeconds`.
- `server/utils/model.ts`: `assistantModel`, the assistant's AI SDK model. It is a scripted stand-in for the hosted model, so it needs no API key. Asked to "Archive <project>", it calls a tool named `archiveProject` with `{ "slug": "<project>" }`; after the tool result it confirms, and after a denied call it says it left the project alone. `archiveProject(slug)` in the store archives a project.
