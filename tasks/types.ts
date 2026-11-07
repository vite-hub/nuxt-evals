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

export interface Task<Runtime = undefined> {
  id: string
  title: string
  probes: Probe<Runtime>[]
  /**
   * Builds and starts the agent's app from its working copy for gate and runtime probes. The grader calls it once,
   * runs every probe in order, then calls `stop`. Tasks without it only have file probes.
   */
  start?(work: string): Promise<StartedTask<Runtime>>
}
