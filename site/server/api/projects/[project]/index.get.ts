import { createError, defineHandler, getRouterParam } from "h3"
import type { ProjectProbe, ProjectView } from "../../../../shared/report"
import type { Rubric, RubricGrade } from "../../../../shared/rubric"
import { projectLabel } from "../../../../shared/labels"
import { projectWorkspace, projectWorkspaces } from "../../../utils/project-workspace"

const stackPackages = ["nuxt", "nitro", "h3", "vue", "@nuxt/ui", "@vueuse/nuxt", "vite-hub", "better-auth", "drizzle-orm", "zod", "chart.js"]

/** The project's starting app: the head of Workspace `main`, with the prompt and probes stored on it. */
export default defineHandler(async (event): Promise<ProjectView> => {
  const project = getRouterParam(event, "project")
  if (!project || !projectWorkspaces.has(project)) throw createError({ status: 404, message: "Unknown project." })
  const workspace = projectWorkspace(project)
  const head = await workspace.history.head()
  if (!head) throw createError({ status: 404, message: "This project has no starting app yet." })
  const view = await workspace.history.open(head.id)
  const entries = await view.list("", { recursive: true })
  const paths = entries.filter(entry => entry.type === "file").map(entry => entry.path.replace(/^\/+/, "")).sort()
  const manifest = JSON.parse(await view.readFile("package.json").catch(() => "{}")) as Record<string, Record<string, string> | undefined>
  const versions = { ...manifest.devDependencies, ...manifest.dependencies }
  const metadata = head.metadata ?? {}
  return {
    project,
    title: typeof metadata.title === "string" ? metadata.title : projectLabel(project),
    revision: head.id,
    createdAt: head.createdAt,
    ...(typeof metadata.prompt === "string" ? { prompt: metadata.prompt } : {}),
    probes: Array.isArray(metadata.probes) ? metadata.probes as ProjectProbe[] : [],
    ...(metadata.rubric ? { rubric: metadata.rubric as Rubric } : {}),
    ...(metadata.reference ? { reference: metadata.reference as RubricGrade } : {}),
    // `npm:nuxt-nightly@5.0.0-…` is an alias; the page shows the version.
    stack: stackPackages.flatMap(name => versions[name] ? [{ name, version: versions[name].replace(/^npm:[^@]+@/, "") }] : []),
    paths,
  }
})
