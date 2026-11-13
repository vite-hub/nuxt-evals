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
}

export interface Task<Runtime = undefined> {
  id: string
  title: string
  /** The starting files, as a folder under tasks/, when tasks share them (`vitehub-ui/fixture`). Default `<id>/fixture`. */
  fixture?: string
  /** The probe score (0 to 1) a run must reach, written down before the first run. */
  target?: number
  /** Why the task can't run yet, such as a ViteHub feature that doesn't exist. `evals run` refuses it. */
  pending?: string
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
