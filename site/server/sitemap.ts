import { isNotNull, max } from "drizzle-orm"
import { useDatabase } from "vite-hub/database"
import { defineSitemap } from "vite-hub/seo"

/** One page per project with graded runs, as the results page lists them. Run pages come from Content. */
export default defineSitemap(async () => {
  const { db, schema } = useDatabase("default")
  const projects = await db
    .select({ project: schema.runs.project, lastmod: max(schema.runs.startedAt) })
    .from(schema.runs)
    .where(isNotNull(schema.runs.rubric))
    .groupBy(schema.runs.project)
  return projects.map(({ project, lastmod }) => ({ loc: `/projects/${encodeURIComponent(project)}`, ...lastmod ? { lastmod } : {} }))
})
