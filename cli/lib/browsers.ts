// The Playwright browsers every agent run gets (#15). A run's HOME is empty, so without them an agent that checks its
// fix in a browser finds none, while one that searches the disk finds whatever ~/.cache/ms-playwright the host has: the
// browser check then graded who goes looking. Every run now gets this folder through PLAYWRIGHT_BROWSERS_PATH, where
// Playwright looks first, so `npx playwright ...` works the same way in both harnesses. The prompt doesn't mention it.
import { execFile } from "node:child_process"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { promisify } from "node:util"
import { cliRoot } from "./paths.ts"

/** Outside the run's HOME and outside this repository. Agents may install other revisions into it. */
export const browsersPath = join(homedir(), ".cache/nuxt-evals/ms-playwright")

/** Installs the Chromium of the CLI's playwright-core into `browsersPath`. Playwright skips a revision it already has. */
export async function ensureBrowsers(): Promise<string> {
  const require = createRequire(join(cliRoot, "package.json"))
  const playwrightCli = join(dirname(require.resolve("playwright-core/package.json")), "cli.js")
  await promisify(execFile)(process.execPath, [playwrightCli, "install", "chromium"], {
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath },
    timeout: 10 * 60_000,
  })
  return browsersPath
}
