// The running app the operate tasks drive: the built Vue app and a small JSON API with state in memory. The grader
// reads the outcome from this server, never from what the agent says.
//   node tasks/vitehub-ui/operate/server.ts <port>
import { readFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { extname, join, normalize } from "node:path"

export interface Settings {
  name: string
  description: string
  region: string
  visibility: string
  autoDeploy: boolean
  previews: boolean
  emailOnFailure: boolean
  weeklyDigest: boolean
  slackAlerts: boolean
}

export interface Invite {
  name: string
  role: string
  startDate: string
  agreed: boolean
  note: string
}

export interface AppState {
  settings: Settings
  saves: Settings[]
  invites: Invite[]
}

export const initialSettings: Settings = {
  name: "Atlas",
  description: "The marketing site and its preview deployments.",
  region: "iad",
  visibility: "private",
  autoDeploy: true,
  previews: true,
  emailOnFailure: true,
  weeklyDigest: false,
  slackAlerts: true,
}

const dist = join(import.meta.dirname, "app/dist")
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" }

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null")
}

function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value))
}

export function startOperateServer(port: number): Promise<{ origin: string, state: AppState, close: () => Promise<void> }> {
  const state: AppState = { settings: { ...initialSettings }, saves: [], invites: [] }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")
    try {
      if (url.pathname === "/api/settings" && request.method === "GET") return send(response, 200, state.settings)
      if (url.pathname === "/api/settings" && request.method === "PUT") {
        const next = await body(request) as Settings
        state.settings = { ...state.settings, ...next }
        state.saves.push(next)
        return send(response, 200, state.settings)
      }
      if (url.pathname === "/api/invites" && request.method === "POST") {
        const invite = await body(request) as Invite
        state.invites.push(invite)
        return send(response, 201, invite)
      }
      if (url.pathname === "/api/invites" && request.method === "GET") return send(response, 200, state.invites)
      if (url.pathname.startsWith("/api/")) return send(response, 404, { message: "Not found" })
      const file = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "")
      const path = extname(file) ? join(dist, file) : join(dist, "index.html")
      const content = await readFile(path)
      response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" }).end(content)
    }
    catch {
      send(response, 404, { message: "Not found" })
    }
  })
  return new Promise((resolve, reject) => {
    server.once("error", reject).listen(port, "127.0.0.1", () => resolve({
      origin: `http://127.0.0.1:${port}`,
      state,
      close: () => new Promise(done => server.close(() => done())),
    }))
  })
}

if (import.meta.main) {
  const { origin } = await startOperateServer(Number(process.argv[2] ?? 4791))
  console.log(origin)
}
