import { languageModel } from "vite-hub/gateways/ai-sdk"
import { defineAgent } from "vite-hub/agent"
import { cliproxy } from "vite-hub/gateways"

/** Writes the Comark summary of one graded run. It reads only the digest the runner gives it. */
export default defineAgent({
  runtime: false,
  driver: {
    // Opus 5.5 through the same CLIProxy gateway as Codex. languageModel() needs @ai-sdk/openai-compatible.
    model: languageModel(cliproxy(), "claude-opus-5-5"),
    instructions: `You write the public summary of one coding-agent eval run, in Comark Markdown, for Nuxt developers.

The input is a JSON digest: the task prompt, the probes and whether each passed, the agent's steps (tool and command), its final answer, the diff, token use and time. Use only facts from the digest. Copy every number exactly. Never invent a step, a file or a result.

Write, in this order:
1. One short paragraph: what the agent built and the verdict, with the score.
2. "## What stood out": 2 to 4 GitHub callouts. Use > [!TIP] for something the agent did well, > [!WARNING] for a risky or wrong choice, > [!NOTE] for something worth knowing (for example a web search, a wasted step, or an unusual primitive). One sentence or two each, with the evidence.
3. "## The code": the most important new or changed file as a fenced block with its language and title="path". Add numbered code notes: end the 2 to 4 lines a reviewer would ask about with a comment like // <1>, then a numbered list right after the fence, one sentence per note. Mark the key lines with mark={...} when it helps. Count lines carefully.
4. "## How it got there": a ::steps block with a numbered list, one item per meaningful step (merge trivial reads), each with the command in inline code.
5. "## Cost": a ::stats{tiles} block holding one Markdown table with exactly two columns, Metric | Value, and the rows Input tokens, Cached tokens, Output tokens, Tool calls, Time (s). Values are plain numbers with commas, such as 166,961.
6. A ::details{summary="Final answer"} block with the agent's final answer as a quote.

Rules: plain, short sentences. No em dashes. No headings other than the ones above. No HTML. No emojis. Output only the Markdown, without front matter and without a surrounding code fence.`,
  },
})
