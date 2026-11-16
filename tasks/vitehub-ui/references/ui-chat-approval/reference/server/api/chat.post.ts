import { convertToModelMessages, streamText, tool, type UIMessage } from "ai"
import { defineHandler, readBody } from "h3"
import { z } from "zod"
import { assistantModel } from "../utils/model"
import { archiveProject } from "../utils/store"

export default defineHandler(async (event) => {
  const { messages } = await readBody<{ messages: UIMessage[] }>(event) ?? { messages: [] }
  const result = streamText({
    model: assistantModel,
    system: "You help teams manage their projects in Acme Console.",
    messages: await convertToModelMessages(messages),
    tools: {
      archiveProject: tool({
        description: "Archive a project. It leaves the project list but keeps its data.",
        inputSchema: z.object({ slug: z.string() }),
        needsApproval: true,
        execute: async ({ slug }) => archiveProject(slug) ? { archived: slug } : { error: `No project ${slug}` },
      }),
    },
  })
  return result.toUIMessageStreamResponse()
})
