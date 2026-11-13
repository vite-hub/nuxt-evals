// A stdio MCP server that gives a coding agent ui-sdk's agent bridge on a page that is already open, as a person's
// browser tab would be. The page creates the bridge with `createAgent({ allow })` and puts it on `window.uiAgent`,
// with ui-sdk's own `agentTools` on `window.uiAgentTools`. This server lists those tools as they are and runs each
// call in the page with Playwright's `page.evaluate`. It logs every call, so the grader can count them.
//   OPERATE_URL=<page> OPERATE_LOG=<file.jsonl> node bridge-mcp.ts
import { appendFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { createInterface } from "node:readline"
import { pathToFileURL } from "node:url"
import type { Page } from "playwright-core"

interface Tool { name: string, description: string, inputSchema: object }
interface Request { jsonrpc: "2.0", id?: number | string, method: string, params?: { name?: string, arguments?: unknown, protocolVersion?: string } }
type BridgeWindow = Window & { uiAgent?: Record<string, (input: unknown) => unknown>, uiAgentTools?: Tool[] }

const url = process.env.OPERATE_URL
const log = process.env.OPERATE_LOG
if (!url) throw new Error("Set OPERATE_URL.")

const require = createRequire(join(import.meta.dirname, "../../../cli/package.json"))
const playwright = await import(pathToFileURL(join(dirname(require.resolve("playwright-core/package.json")), "index.mjs")).href) as typeof import("playwright-core")
const browser = await playwright.chromium.launch({ headless: true })
const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(url, { waitUntil: "load" })
await page.waitForFunction(() => Boolean((window as BridgeWindow).uiAgent && document.querySelector("form button")), undefined, { timeout: 20_000 })
const tools = await page.evaluate(() => ((window as BridgeWindow).uiAgentTools ?? []).map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })))

function reply(id: Request["id"], result: unknown) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

async function call(name: string, input: unknown): Promise<{ text: string, isError: boolean }> {
  const started = Date.now()
  let text: string
  let isError = false
  try {
    const result = await page.evaluate(async ([tool, args]) => {
      const agent = (window as BridgeWindow).uiAgent
      if (!agent || typeof agent[tool] !== "function") throw new Error(`No tool ${tool}.`)
      return await agent[tool](args ?? {})
    }, [name, input] as const)
    text = JSON.stringify(result)
  }
  catch (error) {
    isError = true
    text = error instanceof Error ? error.message : String(error)
  }
  if (log) await appendFile(log, `${JSON.stringify({ name, input, chars: text.length, isError, ms: Date.now() - started })}\n`)
  return { text, isError }
}

const lines = createInterface({ input: process.stdin })
lines.on("line", async (line) => {
  if (!line.trim()) return
  const request = JSON.parse(line) as Request
  if (request.id === undefined) return
  if (request.method === "initialize") {
    return reply(request.id, { protocolVersion: request.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "ui-sdk-bridge", version: "0.1.0" } })
  }
  if (request.method === "tools/list") return reply(request.id, { tools })
  if (request.method === "tools/call") {
    const { text, isError } = await call(request.params?.name ?? "", request.params?.arguments)
    return reply(request.id, { content: [{ type: "text", text }], isError })
  }
  if (request.method === "ping") return reply(request.id, {})
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Unknown method ${request.method}` } })}\n`)
})
lines.on("close", () => void browser.close())
