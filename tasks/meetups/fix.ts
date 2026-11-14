// What every Meetups fix project shares. The agent gets the Meetups app (tasks/meetups/base, comments stripped) with one
// planted bug and a user's report of it, and no skills. The judge builds its fix, a script checks the reported problem
// is gone (the gate), and one grading session reads the change against the ranked solutions in the project's RUBRIC.md.
import type { FixtureEdit, JudgeConfig, ScriptedContext, ScriptedResult, Task } from "../types.ts"
import meetups from "./task.ts"

/** The graders' servers answer from SQLite as if it were a remote database. See remote-db/register.mjs. */
export const remoteDatabase = { NODE_OPTIONS: `--import=${new URL("./remote-db/register.mjs", import.meta.url).href}` }

export function fixJudge(scripted: { checks: string[], run(context: ScriptedContext): Promise<Record<string, ScriptedResult>> }, serverEnv?: Record<string, string>): JudgeConfig {
  const build = meetups.judge!
  return {
    groups: [{ name: "fix", sections: ["R", "S", "P", "C", "V"] }],
    // C1 is "installs, builds and starts": the setup session grades it.
    setupChecks: ["C1"],
    build: `node_modules is already installed for this package.json: don't install again unless that fails. ${build.build.replace("Install its dependencies, prepare", "Prepare")}`,
    setupGrading: port => `Grade C1: start the production server on port ${port} (set PORT, NITRO_PORT, HOST=127.0.0.1 and NITRO_HOST=127.0.0.1), open the home page, and stop the server. Start it with node, not pnpm (\`node --env-file-if-exists=.env .output/server/index.mjs\`, what \`pnpm start\` runs), and report that command as startCommand: pnpm refuses to run scripts over the copied node_modules.`,
    sharedServer: build.sharedServer,
    rules: (app, scratch) => [
      "Grade the agent's change to the app it got, from the patch and the code. The rest of the app is the same in every run. Accept every correct form of a fix: the ranked solutions in the rubric are the ones we know, not the only good ones. A fix that matches none of them is graded on its merits; say \"novel\" in the evidence of S1.",
      ...build.rules(app, scratch).slice(1),
    ],
    apis: build.apis,
    scripted,
    ...(serverEnv ? { serverEnv } : {}),
  }
}

/** A Meetups fix project: its id, title, planted edits and scripted checks. Its PROMPT.md and RUBRIC.md sit beside it. */
export function fixTask(options: { id: string, title: string, edits: FixtureEdit[], scripted: Parameters<typeof fixJudge>[0], serverEnv?: Record<string, string>, timeLimitMinutes?: number }): Task {
  return {
    id: options.id,
    title: options.title,
    kind: "fix",
    rubric: true,
    plant: { base: "meetups/base", edits: options.edits },
    vibe: "meetups/FIX-VIBE.md",
    timeLimitMinutes: options.timeLimitMinutes ?? 45,
    probes: [],
    judge: fixJudge(options.scripted, options.serverEnv),
  }
}
