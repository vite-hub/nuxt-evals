# Patches to upstream

nuxt-evals runs on pkg.pr.new builds of [vite-hub/vitehub](https://github.com/vite-hub/vitehub) (`pnpm --filter site exec vitehub update --preview <sha>` moves every package to one commit). When ViteHub lacks something this project needs, the fix lands here first, then goes upstream as one PR per concern, so every ViteHub app gets it. Delete it here once its PR is merged and released.

pnpm can't run `pnpm patch-commit` on a pkg.pr.new dependency: it tries to fetch the version from npm. Make the patch by hand instead: `pnpm patch <pkg>@<version> --edit-dir /tmp/x`, edit, then `git diff --no-index` the installed copy against `/tmp/x` with `a/` and `b/` paths. Bumping the commit changes the dist file hashes, so rebase each patch on the new build.

## ViteHub main

Since 2026-11-12 the pinned commit is on `main` of vite-hub/vitehub again: the UI work that needed branch `preview/nuxt-evals` merged (#3952 code focus, #3722 AgentSession, #3764 DeviceFrame). pkg.pr.new builds only commits whose CI passed, so pin the newest `main` commit that `https://pkg.pr.new/vite-hub/vitehub/vite-hub@<sha>` answers.

The Console is console.vitehub.dev with signed calls (`console: true`); the app keeps the link's public key as the Worker secret `VITEHUB_CONSOLE_KEY_CONSOLE_<id>`.

## No patches

The `@vite-hub/agent/sessions` patch merged upstream as [vite-hub/vitehub#4178](https://github.com/vite-hub/vitehub/pull/4178), so nuxt-evals carries no patch today. Add the next one here, one section per concern, with its upstream PR.
