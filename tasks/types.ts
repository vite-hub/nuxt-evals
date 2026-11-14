export interface TaskFile {
  path: string
  content: string
}

export interface ProbeInput<Runtime = undefined> {
  /** Files in the working copy after the run, without node_modules and .git. */
  files: TaskFile[]
  /** Every file the agent added or changed, joined. Probes match against this. */
  source: string
  /** Files the agent added or changed. */
  changed: TaskFile[]
  /** The built and started app, for gate and runtime probes. `undefined` for tasks without `start`. */
  runtime: Runtime
}

export interface ProbeOutcome {
  passed: boolean
  /** What the probe saw, in a few words. Shown next to the result. */
  detail?: string
}

export interface Probe<Runtime = undefined> {
  id: string
  title: string
  /** One plain sentence: why this matters to the people who use the app. */
  why?: string
  layer: "gate" | "runtime" | "static" | "judge"
  check(input: ProbeInput<Runtime>): boolean | ProbeOutcome | Promise<boolean | ProbeOutcome>
}

export interface StartedTask<Runtime> {
  runtime: Runtime
  stop: () => Promise<void>
}

/** One change to a starting app. `find` must match exactly once; `content` writes the whole file; `remove` deletes it. */
export type FixtureEdit =
  | { path: string, find: string, replace: string }
  | { path: string, content: string }
  | { path: string, remove: true }

/** What a scripted check found. The CLI stores it as the check's result, like a judge's answer. */
export interface ScriptedResult {
  outcome: "pass" | "fail" | "na" | "unverified"
  evidence: string
}

/** What a project's scripted checks get: the production server the CLI started, and a way to start a second one. */
export interface ScriptedContext {
  /** `http://localhost:<port>`. */
  origin: string
  /** The app folder the server runs from. */
  app: string
  /** A folder for the script's own files. */
  scratch: string
  /** Starts one more production server of the same app (same folder, database and settings) and returns its origin. */
  startAnother(): Promise<{ origin: string, stop: () => Promise<void> }>
  /** playwright-core, for checks that need a browser: `(await importPlaywright()).chromium.launch()`. */
  importPlaywright(): Promise<typeof import("playwright-core")>
  log(line: string): void
}

/** What the rubric judge needs to know about a project's stack. Everything else in its prompts is the same for every project. */
export interface JudgeConfig {
  /** Sections each grading session takes, at most three sessions at a time. */
  groups: { name: string, sections: string[] }[]
  /** Checks the setup session grades, such as P1: the ones that need a build or a server restart. */
  setupChecks: string[]
  /** Step 1 of the setup session: how to install and build the app. */
  build: string
  /** Step 2 of the setup session: how to grade `setupChecks` with a server on `port`. */
  setupGrading(port: number): string
  /** What graders sharing the running build at `origin` must and mustn't do. `group` is their session's name. */
  sharedServer(origin: string, group: string, app: string): string
  /** Grading rules for this stack, one per line, about `app` (the app's folder) and `scratch` (the grader's own). */
  rules(app: string, scratch: string): string[]
  /** The APIs a fix names, such as "Nuxt 5, Nitro v3, h3 v2, Vue, Better Auth or ViteHub". */
  apis: string
  /**
   * Settings for the production servers the CLI starts for graders (not the agent's), such as a `NODE_OPTIONS` preload
   * that makes the local database answer like a remote one.
   */
  serverEnv?: Record<string, string>
  /** A project graded from its files alone (a code review): no build, no server, no Vite Doctor. */
  static?: boolean
  /**
   * Checks a script grades against the running production server before the judge sessions start, such as "ten parallel
   * RSVPs give exactly two seats". The judge sessions skip them and read their results.
   */
  scripted?: { checks: string[], run(context: ScriptedContext): Promise<Record<string, ScriptedResult>> }
}

export interface Task<Runtime = undefined> {
  id: string
  title: string
  /**
   * `build` (the default): the agent builds an app from a prompt. `fix`: the agent gets an app with one planted bug and a
   * user's report of it. `scan`: the agent reviews an app with planted bugs without running it and lists what it finds.
   */
  kind?: "build" | "fix" | "scan"
  /**
   * Fix and scan projects: the starting app is `base` (a folder under tasks/, such as `meetups/base`) with these edits,
   * instead of a `fixture/` folder. `base` is also the reference app, the yardstick the judge grades the same way.
   */
  plant?: {
    base: string
    edits: FixtureEdit[]
    /**
     * The reference app is the clean base by default (a fix project's best fix). A scan project's reference is its
     * starting app with these edits on top, such as the answer key's findings.json.
     */
    reference?: FixtureEdit[]
  }
  /** The design pass's anchors, from tasks/. Default `<id>/VIBE.md`; a project without one skips the pass. */
  vibe?: string
  /** Graded by the Opus judge against RUBRIC.md after each run, with `reference/` as the yardstick. */
  rubric?: boolean
  /** How long the agent may work. Default 60. */
  timeLimitMinutes?: number
  /** How the judge builds and grades the app. Rubric projects have one. */
  judge?: JudgeConfig
  probes: Probe<Runtime>[]
  /**
   * Builds and starts the agent's app from its working copy for gate and runtime probes. The grader calls it once,
   * runs every probe in order, then calls `stop`. Tasks without it only have file probes.
   */
  start?(work: string): Promise<StartedTask<Runtime>>
}
