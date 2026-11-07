export interface TaskFile {
  path: string
  content: string
}

export interface ProbeInput {
  /** Files in the working copy after the run, without node_modules and .git. */
  files: TaskFile[]
  /** Every file the agent added or changed, joined. Probes match against this. */
  source: string
}

export interface Probe {
  id: string
  title: string
  layer: "gate" | "runtime" | "static" | "judge"
  check: (input: ProbeInput) => boolean | Promise<boolean>
}

export interface Task {
  id: string
  title: string
  probes: Probe[]
}
