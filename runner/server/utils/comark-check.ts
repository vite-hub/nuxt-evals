import { parseMarkdown } from "comark"
import comarkUi from "comark-ui/html"

/** The problems Comark reports for a summary, one sentence each. The parse plugins match the site's comark-ui/vue renderer. */
export async function comarkIssues(markdown: string): Promise<string[]> {
  const { plugins } = comarkUi({ chips: { download: false }, icon: { fetch: false }, diagrams: { draw: false } })
  const document = await parseMarkdown(markdown, { plugins })
  const issues = (document.meta as { issues?: unknown[] }).issues ?? []
  return issues.map(issue => typeof issue === "string" ? issue : JSON.stringify(issue))
}
