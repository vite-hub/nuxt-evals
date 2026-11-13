// The assistant's model. Production uses a hosted model; this stand-in follows a script, so the app works without
// an API key and gives the same answers every time. Use it like any AI SDK model: `streamText({ model: assistantModel })`.
//
// The script:
// - "Archive <project>" (for example "Archive Atlas"): it calls the tool `archiveProject` with `{ "slug": "atlas" }`.
// - After the tool result: "Done. <slug> is archived." When the call was denied: "Okay, I left <slug> as it is."
// - Anything else: it says what it can do.
import { MockLanguageModelV4 } from "ai/test"

type StreamOptions = Parameters<MockLanguageModelV4["doStream"]>[0]
type Message = StreamOptions["prompt"][number]

function lastUserText(messages: Message[]): string {
  const message = messages.findLast(item => item.role === "user")
  if (message?.role !== "user") return ""
  return message.content.map(part => part.type === "text" ? part.text : "").join(" ")
}

/** The answer to the last tool call, when the model already asked for one after the user's last message. */
function toolAnswer(messages: Message[]): { slug: string, denied: boolean } | undefined {
  const lastUser = messages.findLastIndex(item => item.role === "user")
  const recent = messages.slice(lastUser + 1)
  const call = recent.flatMap(item => item.role === "assistant" ? item.content : []).findLast(part => part.type === "tool-call")
  const result = recent.flatMap(item => item.role === "tool" ? item.content : []).findLast(part => part.type === "tool-result")
  if (call?.type !== "tool-call" || result?.type !== "tool-result") return undefined
  const input = typeof call.input === "string" ? JSON.parse(call.input) as { slug?: string } : call.input as { slug?: string }
  return { slug: input.slug ?? "the project", denied: result.output.type === "execution-denied" }
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
}

function textStream(text: string) {
  return [
    { type: "text-start" as const, id: "text-1" },
    ...text.split(/(?<= )/).map(delta => ({ type: "text-delta" as const, id: "text-1", delta })),
    { type: "text-end" as const, id: "text-1" },
    { type: "finish" as const, usage, finishReason: { unified: "stop" as const, raw: "stop" } },
  ]
}

function reply(options: StreamOptions) {
  const answer = toolAnswer(options.prompt)
  if (answer) return textStream(answer.denied ? `Okay, I left ${answer.slug} as it is.` : `Done. ${answer.slug} is archived.`)
  const project = lastUserText(options.prompt).match(/\barchive\s+(?:the\s+)?(?:project\s+)?["']?([\w-]+)/i)?.[1]
  if (!project) return textStream("I can archive a project for you. Try: Archive Atlas.")
  return [
    { type: "tool-call" as const, toolCallId: `call-${Date.now().toString(36)}`, toolName: "archiveProject", input: JSON.stringify({ slug: project.toLowerCase() }) },
    { type: "finish" as const, usage, finishReason: { unified: "tool-calls" as const, raw: "tool_calls" } },
  ]
}

export const assistantModel = new MockLanguageModelV4({
  provider: "acme",
  modelId: "acme-assistant",
  doStream: async (options) => {
    const parts = [{ type: "stream-start" as const, warnings: [] }, ...reply(options)]
    return {
      stream: new ReadableStream({
        async start(controller) {
          for (const part of parts) {
            controller.enqueue(part)
            await new Promise(resolve => setTimeout(resolve, 15))
          }
          controller.close()
        },
      }),
    }
  },
})
